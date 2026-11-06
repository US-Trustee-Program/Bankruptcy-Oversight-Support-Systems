import { randomUUID } from 'crypto';
import {
  activeKeyFor,
  ALL_SCOPE,
  RoleAssignmentGrantResult,
  CamsUsersPredicate,
  CamsUserWithPermissions,
  RoleAssignmentAuditEntry,
  RoleAssignmentGrantRequest,
  roleAssignmentGrantRequestSpec,
  UserRoleAssignment,
} from '@common/cams/user-access';
import { CamsUserReference } from '@common/cams/users';
import { getCamsUserReference } from '@common/cams/session';
import { flatten, validateObject } from '@common/cams/validation';
import { ApplicationContext } from '../../adapters/types/basic';
import { BadRequestError } from '../../common-errors/bad-request';
import { CamsError } from '../../common-errors/cams-error';
import factory from '../../factory';
import { RoleAssignmentAuditRepository, UserRoleAssignmentRepository } from '../gateways.types';

const MODULE_NAME = 'USER-ACCESS-USE-CASE';
const MEMBER_CACHE_TTL_MS = 15 * 60 * 1000;

const AUDIT_WRITE_FAILED_MESSAGE = 'ROLE_ASSIGNMENT_AUDIT write failed';

// The "USTP Cams Users" member list, cached per process. Assignments are never cached.
let memberCache: { members: CamsUserReference[]; expiresAt: number } | null = null;

export function resetCamsUsersCache() {
  memberCache = null;
}

function includesIgnoringCase(value: string | undefined, search: string | undefined): boolean {
  return !search || (value ?? '').toLowerCase().includes(search.toLowerCase());
}

function byRegionThenOffice(a: UserRoleAssignment, b: UserRoleAssignment): number {
  const numeric = { numeric: true };
  return (
    (a.regionId ?? '').localeCompare(b.regionId ?? '', undefined, numeric) ||
    (a.officeCode ?? '').localeCompare(b.officeCode ?? '', undefined, numeric)
  );
}

export class UserAccessUseCase {
  private readonly assignmentRepository: UserRoleAssignmentRepository;
  private readonly auditRepository: RoleAssignmentAuditRepository;

  constructor(context: ApplicationContext) {
    this.assignmentRepository = factory.getUserRoleAssignmentRepository(context);
    this.auditRepository = factory.getRoleAssignmentAuditRepository(context);
  }

  async getCamsUsers(
    context: ApplicationContext,
    predicate: CamsUsersPredicate,
  ): Promise<{ data: CamsUserWithPermissions[]; totalCount: number }> {
    const members = (await this.getMembers(context)).filter(
      (member) =>
        includesIgnoringCase(member.name, predicate.name) &&
        includesIgnoringCase(member.email, predicate.email),
    );
    const page = members.slice(predicate.offset, predicate.offset + predicate.limit);

    const assignments = await this.assignmentRepository.findActiveByUserIds(
      page.map((member) => member.id),
    );
    const data = page.map((member) => ({
      ...member,
      permissions: assignments
        .filter((assignment) => assignment.userId === member.id)
        .sort(byRegionThenOffice),
    }));

    return { data, totalCount: members.length };
  }

  /**
   * Grants a permission. Granting one the user already holds changes nothing: no permission, audit
   * record or telemetry is written, and `created` is false.
   */
  async grantPermission(
    context: ApplicationContext,
    request: RoleAssignmentGrantRequest,
  ): Promise<{ result: RoleAssignmentGrantResult; created: boolean }> {
    const validation = validateObject(roleAssignmentGrantRequestSpec, request);
    if (!validation.valid) {
      const reasons = [...(validation.reasons ?? []), ...flatten(validation.reasonMap ?? {})];
      throw new BadRequestError(MODULE_NAME, { message: reasons.join('. ') + '.' });
    }
    if (request.regionId === ALL_SCOPE || request.officeCode === ALL_SCOPE) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Region-wide and national grants are not available yet.',
      });
    }

    const member = (await this.getMembers(context)).find((m) => m.id === request.userId);
    if (!member) {
      throw new BadRequestError(MODULE_NAME, { message: 'The user is not a CAMS user.' });
    }

    const offices = await factory.getOfficesGateway(context).getOffices(context);
    const office = offices.find((o) => o.officeCode === request.officeCode);
    if (!office) {
      throw new BadRequestError(MODULE_NAME, { message: 'The office does not exist.' });
    }
    if (office.regionId !== request.regionId) {
      throw new BadRequestError(MODULE_NAME, { message: 'The office is not in that region.' });
    }

    const activeKey = activeKeyFor(request.role, office.regionId, office.officeCode);
    const held = await this.findHeld(member.id, request.role, activeKey);
    if (held) {
      return { result: { permission: held, replaced: [] }, created: false };
    }

    const performer = getCamsUserReference(context.session.user);
    const now = new Date().toISOString();
    const assignment: UserRoleAssignment = {
      documentType: 'USER_ROLE_ASSIGNMENT',
      id: randomUUID(),
      userId: member.id,
      userName: member.name,
      email: member.email,
      role: request.role,
      regionId: office.regionId,
      officeCode: office.officeCode,
      assignedBy: performer.id,
      assignedByName: performer.name,
      assignedAt: now,
      expiresAt: null,
      active: true,
      activeKey,
    };
    const created = await this.assignmentRepository.create(assignment);
    if (!created) {
      // Another grant wrote the same permission between our read and our write.
      const written = await this.findHeld(member.id, request.role, activeKey);
      if (!written) {
        throw new CamsError(MODULE_NAME, { message: 'Unable to create role assignment.' });
      }
      return { result: { permission: written, replaced: [] }, created: false };
    }

    const newState = {
      role: created.role,
      regionId: created.regionId,
      officeCode: created.officeCode,
      active: created.active,
    };
    // The top-level role and scope are read from newState so the two can't disagree.
    const audit: RoleAssignmentAuditEntry = {
      documentType: 'ROLE_ASSIGNMENT_AUDIT',
      id: randomUUID(),
      assignmentId: created.id,
      action: 'CREATED',
      userId: created.userId,
      userName: created.userName,
      role: newState.role,
      regionId: newState.regionId,
      officeCode: newState.officeCode,
      performedBy: performer.id,
      performedByName: performer.name,
      performedAt: now,
      previousState: null,
      newState,
      reason: request.reason.trim(),
    };

    // The writes are sequential, not atomic: a failed audit write keeps the grant.
    try {
      await this.auditRepository.create(audit);
    } catch (error) {
      context.logger.error(MODULE_NAME, `${AUDIT_WRITE_FAILED_MESSAGE}: ${error.message}`, {
        audit,
      });
    }

    this.trackAudit(context, audit);

    return { result: { permission: created, replaced: [] }, created: true };
  }

  private async findHeld(
    userId: string,
    role: RoleAssignmentGrantRequest['role'],
    activeKey: string,
  ): Promise<UserRoleAssignment | undefined> {
    const permissions = await this.assignmentRepository.findActiveByUserAndRole(userId, role);
    return permissions.find((permission) => permission.activeKey === activeKey);
  }

  private async getMembers(context: ApplicationContext): Promise<CamsUserReference[]> {
    if (memberCache && Date.now() < memberCache.expiresAt) {
      context.logger.debug(
        MODULE_NAME,
        `CAMS users member list cache hit: ${memberCache.members.length} members.`,
      );
      return memberCache.members;
    }
    const gateway = await factory.getUserGroupGateway(context);
    const group = await gateway.getUserGroupWithUsers(
      context,
      factory.getStorageGateway(context).getCamsUsersGroupName(),
    );
    // Keep only the reference fields so no other Okta profile data reaches the response.
    const members = (group.users ?? [])
      .map(({ id, name, email }) => ({ id, name, email }))
      .sort((a, b) => a.name.localeCompare(b.name));
    context.logger.debug(
      MODULE_NAME,
      `CAMS users member list cache miss: read ${members.length} members from Okta.`,
    );
    memberCache = { members, expiresAt: Date.now() + MEMBER_CACHE_TTL_MS };
    return members;
  }

  private trackAudit(context: ApplicationContext, audit: RoleAssignmentAuditEntry) {
    try {
      const trace = context.observability.startTrace(context.invocationId);
      context.observability.completeTrace(
        trace,
        'RoleAssignmentAudit',
        {
          success: true,
          properties: {
            auditId: audit.id,
            assignmentId: audit.assignmentId,
            action: audit.action,
            userId: audit.userId,
            userName: audit.userName,
            role: audit.role,
            regionId: audit.regionId ?? '',
            officeCode: audit.officeCode ?? '',
            performedBy: audit.performedBy,
            performedByName: audit.performedByName,
            performedAt: audit.performedAt,
            reason: audit.reason,
          },
          measurements: {},
        },
        undefined,
        context.logger,
      );
    } catch (error) {
      context.logger.error(MODULE_NAME, `RoleAssignmentAudit telemetry failed: ${error.message}`, {
        auditId: audit.id,
      });
    }
  }
}
