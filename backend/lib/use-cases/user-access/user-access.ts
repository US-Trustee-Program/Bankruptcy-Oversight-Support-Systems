import { randomUUID } from 'crypto';
import {
  activeKeyFor,
  ALL_SCOPE,
  PermissionScope,
  RoleAssignmentGrantResult,
  scopesOverlap,
  CamsUsersPredicate,
  CamsUserWithPermissions,
  RoleAssignmentAuditEntry,
  RoleAssignmentGrantRequest,
  roleAssignmentGrantRequestSpec,
  UserRoleAssignment,
} from '@common/cams/user-access';
import { CamsRole } from '@common/cams/roles';
import { UstpOfficeDetails } from '@common/cams/offices';
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

const DEACTIVATION_FAILED_MESSAGE = 'ROLE_ASSIGNMENT_DEACTIVATION failed';

function badRequest(message: string) {
  return new BadRequestError(MODULE_NAME, { message });
}

/**
 * Turns the path's region and office into a scope. Super User has no region or office; 'all' means
 * every region or every office in the region.
 */
function scopeFromPath(request: RoleAssignmentGrantRequest): PermissionScope {
  const everyRegion = request.regionId === ALL_SCOPE;
  const everyOffice = request.officeCode === ALL_SCOPE;
  if (request.role === CamsRole.SuperUser) {
    if (!everyRegion || !everyOffice) throw badRequest('Super User has no region or office.');
    return { regionId: null, officeCode: null };
  }
  if (everyRegion) {
    if (!everyOffice) throw badRequest('An office needs its region.');
    return { regionId: null, officeCode: null };
  }
  if (everyOffice) return { regionId: request.regionId, officeCode: null };
  return { regionId: request.regionId, officeCode: request.officeCode };
}

/** Checks a scope against the live office list. Only granting needs this; revoking does not. */
function assertScopeExists(scope: PermissionScope, offices: UstpOfficeDetails[]) {
  if (scope.regionId === null) return;
  if (scope.officeCode === null) {
    if (!offices.some((o) => o.regionId === scope.regionId)) {
      throw badRequest('The region does not exist.');
    }
    return;
  }
  const office = offices.find((o) => o.officeCode === scope.officeCode);
  if (!office) throw badRequest('The office does not exist.');
  if (office.regionId !== scope.regionId) throw badRequest('The office is not in that region.');
}

function validateRequest(request: RoleAssignmentGrantRequest) {
  const validation = validateObject(roleAssignmentGrantRequestSpec, request);
  if (!validation.valid) {
    const reasons = [...(validation.reasons ?? []), ...flatten(validation.reasonMap ?? {})];
    throw new BadRequestError(MODULE_NAME, { message: reasons.join('. ') + '.' });
  }
}

function stateOf(assignment: UserRoleAssignment) {
  return {
    role: assignment.role,
    regionId: assignment.regionId,
    officeCode: assignment.officeCode,
    active: assignment.active,
  };
}

function auditEntry(
  action: RoleAssignmentAuditEntry['action'],
  assignment: UserRoleAssignment,
  previousState: RoleAssignmentAuditEntry['previousState'],
  newState: RoleAssignmentAuditEntry['newState'],
  performer: CamsUserReference,
  performedAt: string,
  replacedByAssignmentId: string | null,
): RoleAssignmentAuditEntry {
  // The top-level role and scope are read from the state so the two can't disagree.
  const { role, regionId, officeCode } = newState;
  return {
    documentType: 'ROLE_ASSIGNMENT_AUDIT',
    id: randomUUID(),
    assignmentId: assignment.id,
    action,
    userId: assignment.userId,
    userName: assignment.userName,
    role,
    regionId,
    officeCode,
    performedBy: performer.id,
    performedByName: performer.name,
    performedAt,
    previousState,
    newState,
    replacedByAssignmentId,
  };
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
   * Grants a permission and converges: afterwards the user holds it, and no other active permission
   * for that role whose scope overlaps it (each replaced one is deactivated with its own audit
   * record). Granting a permission the user already holds writes nothing new, but still replaces
   * any overlapping permission left behind by an earlier, partly failed grant.
   *
   * Concurrent grants for the same user and role:
   * - Same scope: the unique {userId, activeKey} index keeps one; the loser re-reads and returns it.
   * - Replacing the same permission: deactivate is a compare-and-set on active, so only one grant
   *   lists and audits it.
   * - Different overlapping scopes (e.g. Region 2 - All and Region 2 - Manhattan at the same
   *   moment): both are read before either is written, so both stay active until the next grant
   *   to that user and role converges them. Accepted: no access beyond what was granted, and the
   *   same read-then-write gap exists in case assignment and trustee oversight assignment.
   *
   * The performer recorded on the permission and its audit records defaults to the session user;
   * pass one when there is no session, as for a pipeline call.
   */
  async grantPermission(
    context: ApplicationContext,
    request: RoleAssignmentGrantRequest,
    performer?: CamsUserReference,
  ): Promise<{ result: RoleAssignmentGrantResult; created: boolean }> {
    validateRequest(request);
    const scope = scopeFromPath(request);

    const member = (await this.getMembers(context)).find((m) => m.id === request.userId);
    if (!member) {
      throw new BadRequestError(MODULE_NAME, { message: 'The user is not a CAMS user.' });
    }

    assertScopeExists(scope, await factory.getOfficesGateway(context).getOffices(context));
    const activeKey = activeKeyFor(request.role, scope.regionId, scope.officeCode);
    const actor = performer ?? getCamsUserReference(context.session.user);
    const now = new Date().toISOString();

    let held = await this.assignmentRepository.findActiveByUserAndRole(member.id, request.role);
    let permission = held.find((p) => p.activeKey === activeKey);
    let created = false;

    if (!permission) {
      const assignment: UserRoleAssignment = {
        documentType: 'USER_ROLE_ASSIGNMENT',
        id: randomUUID(),
        userId: member.id,
        userName: member.name,
        email: member.email,
        role: request.role,
        regionId: scope.regionId,
        officeCode: scope.officeCode,
        assignedBy: actor.id,
        assignedByName: actor.name,
        assignedAt: now,
        expiresAt: null,
        active: true,
        activeKey,
      };
      const inserted = await this.assignmentRepository.create(assignment);
      if (inserted) {
        permission = inserted;
        created = true;
        await this.writeAudit(
          context,
          auditEntry('CREATED', inserted, null, stateOf(inserted), actor, now, null),
        );
      } else {
        // Another grant wrote the same permission between our read and our write.
        held = await this.assignmentRepository.findActiveByUserAndRole(member.id, request.role);
        permission = held.find((p) => p.activeKey === activeKey);
        if (!permission) {
          throw new CamsError(MODULE_NAME, { message: 'Unable to create role assignment.' });
        }
      }
    }

    const replaced: UserRoleAssignment[] = [];
    for (const overlapping of held) {
      if (overlapping.activeKey === activeKey || !scopesOverlap(overlapping, scope)) continue;
      let deactivated: UserRoleAssignment | null;
      try {
        deactivated = await this.assignmentRepository.deactivate(overlapping);
      } catch (error) {
        // The new permission stays; granting again finishes replacing the old ones.
        context.logger.error(MODULE_NAME, `${DEACTIVATION_FAILED_MESSAGE}: ${error.message}`, {
          grantedAssignmentId: permission.id,
          replacedAssignmentId: overlapping.id,
        });
        throw new CamsError(MODULE_NAME, { message: 'Unable to replace an existing permission.' });
      }
      // Another grant replaced it after our read; that grant reports and audits it.
      if (!deactivated) continue;
      replaced.push(deactivated);
      await this.writeAudit(
        context,
        auditEntry(
          'DEACTIVATED',
          overlapping,
          stateOf(overlapping),
          stateOf(deactivated),
          actor,
          now,
          permission.id,
        ),
      );
    }

    return { result: { permission, replaced }, created };
  }

  /**
   * Revokes one permission: deactivates it (its activeKey is freed, so it can be granted again) and
   * writes a DEACTIVATED audit record that nothing replaced. Nothing is deleted. Returns
   * { revoked: null } when the user doesn't hold it, including when a concurrent call deactivated
   * it first. Unlike granting, the user need not still be in "USTP Cams Users", and the office need
   * not still exist. The performer defaults to the session user, as for grantPermission.
   */
  async revokePermission(
    context: ApplicationContext,
    request: RoleAssignmentGrantRequest,
    performer?: CamsUserReference,
  ): Promise<{ revoked: UserRoleAssignment | null }> {
    validateRequest(request);
    const scope = scopeFromPath(request);
    const activeKey = activeKeyFor(request.role, scope.regionId, scope.officeCode);
    const actor = performer ?? getCamsUserReference(context.session.user);

    const held = await this.assignmentRepository.findActiveByUserAndRole(
      request.userId,
      request.role,
    );
    const permission = held.find((p) => p.activeKey === activeKey);
    if (!permission) return { revoked: null };

    let revoked: UserRoleAssignment | null;
    try {
      revoked = await this.assignmentRepository.deactivate(permission);
    } catch (error) {
      context.logger.error(MODULE_NAME, `${DEACTIVATION_FAILED_MESSAGE}: ${error.message}`, {
        revokedAssignmentId: permission.id,
      });
      throw new CamsError(MODULE_NAME, { message: 'Unable to revoke the permission.' });
    }
    if (!revoked) return { revoked: null };

    await this.writeAudit(
      context,
      auditEntry(
        'DEACTIVATED',
        permission,
        stateOf(permission),
        stateOf(revoked),
        actor,
        new Date().toISOString(),
        null,
      ),
    );
    return { revoked };
  }

  /** The writes are sequential, not atomic: a failed audit write keeps the change. */
  private async writeAudit(context: ApplicationContext, audit: RoleAssignmentAuditEntry) {
    let saved = true;
    try {
      await this.auditRepository.create(audit);
    } catch (error) {
      saved = false;
      context.logger.error(MODULE_NAME, `${AUDIT_WRITE_FAILED_MESSAGE}: ${error.message}`, {
        audit,
      });
    }
    this.trackAudit(context, audit, saved);
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

  private trackAudit(context: ApplicationContext, audit: RoleAssignmentAuditEntry, saved: boolean) {
    try {
      const trace = context.observability.startTrace(context.invocationId);
      context.observability.completeTrace(
        trace,
        'RoleAssignmentAudit',
        {
          success: saved,
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
            replacedByAssignmentId: audit.replacedByAssignmentId ?? '',
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
