import { randomUUID } from 'crypto';
import {
  activeKeyFor,
  ALL_SCOPE,
  PermissionChange,
  PermissionScope,
  RoleAssignmentGrantResult,
  scopesOverlap,
  toPermissionChange,
  CamsUsersPredicate,
  CamsUserWithPermissions,
  isUnscopedRole,
  RoleAssignmentAuditEntry,
  PermissionRemovalRequest,
  permissionRemovalRequestSpec,
  RoleAssignmentGrantRequest,
  roleAssignmentGrantRequestSpec,
  UserRoleAssignment,
} from '@common/cams/user-access';
import { CamsRole } from '@common/cams/roles';
import { PaginationParameters } from '@common/api/pagination';
import { UstpOfficeDetails } from '@common/cams/offices';
import { CamsUserReference } from '@common/cams/users';
import { getCamsUserReference } from '@common/cams/session';
import { includesIgnoringCase } from '@common/string-helper';
import { flatten, validateObject, ValidationSpec } from '@common/cams/validation';
import { ApplicationContext } from '../../adapters/types/basic';
import { BadRequestError } from '../../common-errors/bad-request';
import { CamsError } from '../../common-errors/cams-error';
import factory from '../../factory';
import {
  RoleAssignmentAuditRepository,
  UserRoleAssignmentRepository,
  UserSessionCacheRepository,
} from '../gateways.types';

const MODULE_NAME = 'USER-ACCESS-USE-CASE';
const MEMBER_CACHE_TTL_MS = 15 * 60 * 1000;

const MAX_CHANGES_PAGE_LIMIT = 100;
const AUDIT_WRITE_FAILED_MESSAGE = 'ROLE_ASSIGNMENT_AUDIT write failed';

// The "USTP Cams Users" member list, cached per process. Assignments are never cached.
let memberCache: { members: CamsUserReference[]; expiresAt: number } | null = null;

export function resetCamsUsersCache() {
  memberCache = null;
}

function byRegionThenOffice(a: UserRoleAssignment, b: UserRoleAssignment): number {
  const numeric = { numeric: true };
  return (
    (a.regionId ?? '').localeCompare(b.regionId ?? '', undefined, numeric) ||
    (a.officeCode ?? '').localeCompare(b.officeCode ?? '', undefined, numeric)
  );
}

const DEACTIVATION_FAILED_MESSAGE = 'ROLE_ASSIGNMENT_DEACTIVATION failed';
const SUPER_USER_RESTORE_FAILED_MESSAGE = 'SUPER_USER_RESTORE failed';
const SESSION_INVALIDATION_FAILED_MESSAGE = 'USER_SESSION_CACHE_INVALIDATION failed';

function badRequest(message: string) {
  return new BadRequestError(MODULE_NAME, { message });
}

function validateRequest<T extends object>(spec: ValidationSpec<T>, request: T) {
  const validation = validateObject(spec, request);
  if (!validation.valid) {
    const reasons = [...(validation.reasons ?? []), ...flatten(validation.reasonMap ?? {})];
    throw new BadRequestError(MODULE_NAME, { message: reasons.join('. ') + '.' });
  }
}

/**
 * Turns the path's region and office into a scope, checking them against the office list. Super
 * User has no region or office; 'all' means every region or every office in the region.
 */
function resolveScope(
  request: RoleAssignmentGrantRequest,
  offices: UstpOfficeDetails[],
): PermissionScope {
  const everyRegion = request.regionId === ALL_SCOPE;
  const everyOffice = request.officeCode === ALL_SCOPE;
  if (isUnscopedRole(request.role)) {
    if (!everyRegion || !everyOffice) throw badRequest('Super User has no region or office.');
    return { regionId: null, officeCode: null };
  }
  if (everyRegion) {
    if (!everyOffice) throw badRequest('An office needs its region.');
    return { regionId: null, officeCode: null };
  }
  if (everyOffice) {
    if (!offices.some((o) => o.regionId === request.regionId)) {
      throw badRequest('The region does not exist.');
    }
    return { regionId: request.regionId, officeCode: null };
  }
  const office = offices.find((o) => o.officeCode === request.officeCode);
  if (!office) throw badRequest('The office does not exist.');
  if (office.regionId !== request.regionId) throw badRequest('The office is not in that region.');
  return { regionId: office.regionId, officeCode: office.officeCode };
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
  private readonly sessionCacheRepository: UserSessionCacheRepository;

  constructor(context: ApplicationContext) {
    this.assignmentRepository = factory.getUserRoleAssignmentRepository(context);
    this.auditRepository = factory.getRoleAssignmentAuditRepository(context);
    this.sessionCacheRepository = factory.getUserSessionCacheRepository(context);
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
   */
  async grantPermission(
    context: ApplicationContext,
    request: RoleAssignmentGrantRequest,
  ): Promise<{ result: RoleAssignmentGrantResult; created: boolean }> {
    validateRequest(roleAssignmentGrantRequestSpec, request);

    const member = (await this.getMembers(context)).find((m) => m.id === request.userId);
    if (!member) {
      throw new BadRequestError(MODULE_NAME, { message: 'The user is not a CAMS user.' });
    }

    const offices = await factory.getOfficesGateway(context).getOffices(context);
    const scope = resolveScope(request, offices);
    const activeKey = activeKeyFor(request.role, scope.regionId, scope.officeCode);
    const performer = getCamsUserReference(context.session.user);
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
        assignedBy: performer.id,
        assignedByName: performer.name,
        assignedAt: now,
        active: true,
        activeKey,
      };
      const inserted = await this.assignmentRepository.create(assignment);
      if (inserted) {
        permission = inserted;
        created = true;
        await this.writeAudit(
          context,
          auditEntry('CREATED', inserted, null, stateOf(inserted), performer, now, null),
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
          performer,
          now,
          permission.id,
        ),
      );
    }

    await this.invalidateSessions(context, member.id);

    return { result: { permission, replaced: replaced.sort(byRegionThenOffice) }, created };
  }

  /**
   * Change History: one row per audit record, newest first. A replacement shows the permission that
   * replaced it, read in one call; if that can't be read, the row's next side is null.
   */
  async getPermissionChanges(
    _context: ApplicationContext,
    paging: Required<PaginationParameters>,
  ): Promise<{ data: PermissionChange[]; totalCount: number }> {
    const { limit, offset } = paging;
    if (
      !Number.isInteger(offset) ||
      offset < 0 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MAX_CHANGES_PAGE_LIMIT
    ) {
      throw new BadRequestError(MODULE_NAME, {
        message: `Offset must be a whole number of 0 or more, and limit a whole number from 1 to ${MAX_CHANGES_PAGE_LIMIT}.`,
      });
    }
    const page = await this.auditRepository.search({ limit, offset });
    const replacingRefs = page.data
      .filter((entry) => entry.replacedByAssignmentId)
      .map((entry) => ({ userId: entry.userId, id: entry.replacedByAssignmentId! }));
    const replacing = await this.assignmentRepository.findByIds(replacingRefs);
    const data = page.data.map((entry) =>
      toPermissionChange(
        entry,
        replacing.find(
          (permission) =>
            permission.userId === entry.userId && permission.id === entry.replacedByAssignmentId,
        ),
      ),
    );
    return { data, totalCount: page.metadata.total };
  }

  /**
   * Removes a permission: deactivates that record (never deletes it), audits it as DEACTIVATED with
   * no replacing permission, and clears the user's cached sessions. Addressed by the record's id, so
   * it removes exactly the permission the Super User saw, even one for an office that no longer
   * exists. Removing a permission that is no longer active, or that isn't that user's, changes
   * nothing. The user need not still be a CAMS user: removal only reduces access. A Super User
   * cannot remove their own Super User permission (their other permissions they can), and a removal
   * that leaves no Super User is undone and refused (best effort; see keepASuperUser).
   */
  async removePermission(context: ApplicationContext, request: PermissionRemovalRequest) {
    validateRequest(permissionRemovalRequestSpec, request);
    // A Super User never removes their own Super User access; the last-Super-User check below
    // covers the rest. One already removed falls through and, like any other, changes nothing.
    if (request.userId === context.session.user.id) {
      const [own] = await this.assignmentRepository.findByIds([
        { userId: request.userId, id: request.permissionId },
      ]);
      if (own?.active && own.role === CamsRole.SuperUser) {
        throw new BadRequestError(MODULE_NAME, {
          message: 'You cannot remove your own Super User permission.',
        });
      }
    }
    const deactivated = await this.assignmentRepository.deactivate({
      userId: request.userId,
      id: request.permissionId,
    });
    if (!deactivated) return;
    if (deactivated.role === CamsRole.SuperUser) {
      await this.keepASuperUser(context, deactivated);
    }

    const performer = getCamsUserReference(context.session.user);
    const now = new Date().toISOString();
    await this.writeAudit(
      context,
      auditEntry(
        'DEACTIVATED',
        deactivated,
        { ...stateOf(deactivated), active: true },
        stateOf(deactivated),
        performer,
        now,
        null,
      ),
    );
    await this.invalidateSessions(context, request.userId);
  }

  /**
   * CAMS must keep at least one Super User. Without multi-document transactions this recounts after
   * the deactivation and undoes it when none remain. Best effort, not atomic: two Super Users
   * removing each other at once are usually both refused, but under Session consistency each recount
   * may miss the other's deactivation and let both through.
   */
  private async keepASuperUser(context: ApplicationContext, deactivated: UserRoleAssignment) {
    let remaining: number;
    try {
      remaining = await this.assignmentRepository.countActiveByRole(CamsRole.SuperUser);
    } catch (error) {
      await this.restoreSuperUser(context, deactivated);
      throw error;
    }
    if (remaining > 0) return;
    await this.restoreSuperUser(context, deactivated);
    throw new BadRequestError(MODULE_NAME, {
      message: 'CAMS must keep at least one Super User.',
    });
  }

  /** A failed restore leaves the permission removed, unaudited; the log names it for a manual fix. */
  private async restoreSuperUser(context: ApplicationContext, deactivated: UserRoleAssignment) {
    const ids = { userId: deactivated.userId, assignmentId: deactivated.id };
    try {
      const restored = await this.assignmentRepository.reactivate(deactivated);
      if (!restored) {
        context.logger.warn(
          MODULE_NAME,
          `${SUPER_USER_RESTORE_FAILED_MESSAGE}: the user holds that permission again`,
          ids,
        );
      }
    } catch (error) {
      context.logger.error(
        MODULE_NAME,
        `${SUPER_USER_RESTORE_FAILED_MESSAGE}: ${error.message}`,
        ids,
      );
      throw error;
    }
  }

  /**
   * Cached sessions hold the roles and offices read at sign-in, so a changed permission would not
   * apply until the user's token rotated. Dropping them makes the next request rebuild the session.
   * A failure keeps the grant or removal: the change then applies at the user's next token refresh.
   */
  private async invalidateSessions(context: ApplicationContext, userId: string) {
    try {
      await this.sessionCacheRepository.deleteByUserId(userId);
    } catch (error) {
      context.logger.error(
        MODULE_NAME,
        `${SESSION_INVALIDATION_FAILED_MESSAGE}: ${error.message}`,
        {
          userId,
        },
      );
    }
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
            role: audit.role,
            regionId: audit.regionId ?? '',
            officeCode: audit.officeCode ?? '',
            performedBy: audit.performedBy,
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
