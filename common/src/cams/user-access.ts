import { CamsRoles, CamsRoleType } from './roles';
import { CamsUserReference } from './users';
import { ValidationSpec } from './validation';
import V from './validators';

/**
 * A CAMS-managed permission: a role granted to a user in a scope.
 *
 * Scope is expressed by the nullable regionId and officeCode:
 * - one office: both set
 * - whole region: regionId set, officeCode null
 * - national or Super User: both null (told apart by the role)
 */
export type UserRoleAssignment = {
  documentType: 'USER_ROLE_ASSIGNMENT';
  id: string;
  userId: string;
  userName: string;
  email?: string;
  role: CamsRoleType;
  regionId: string | null;
  officeCode: string | null;
  assignedBy: string;
  assignedByName: string;
  assignedAt: string;
  expiresAt: string | null;
  active: boolean;
  activeKey: string;
};

type RoleAssignmentState = {
  role: CamsRoleType;
  regionId: string | null;
  officeCode: string | null;
  active: boolean;
};

/**
 * An append-only record of a change to a UserRoleAssignment. A DEACTIVATED entry's
 * replacedByAssignmentId is the id of the newer permission that replaced it, or null when the
 * permission was revoked rather than replaced (the dev-tools superuser revoke). It is always null
 * for CREATED.
 */
export type RoleAssignmentAuditEntry = {
  documentType: 'ROLE_ASSIGNMENT_AUDIT';
  id: string;
  assignmentId: string;
  action: 'CREATED' | 'DEACTIVATED';
  userId: string;
  userName: string;
  role: CamsRoleType;
  regionId: string | null;
  officeCode: string | null;
  performedBy: string;
  performedByName: string;
  performedAt: string;
  previousState: RoleAssignmentState | null;
  newState: RoleAssignmentState;
  replacedByAssignmentId: string | null;
};

/** The path segment that stands for every region or every office in a grant. */
export const ALL_SCOPE = 'all';

/**
 * A grant, as sent to PUT /user-access/users/:userId/permissions/:role/:regionId/:officeCode.
 * `regionId` and `officeCode` are ALL_SCOPE for every region or office. Granting a permission the
 * user already holds changes nothing.
 */
export type RoleAssignmentGrantRequest = {
  userId: string;
  role: CamsRoleType;
  regionId: string;
  officeCode: string;
};

/** The outcome of a grant: the permission the user now holds, and any it replaced. */
export type RoleAssignmentGrantResult = {
  permission: UserRoleAssignment;
  replaced: UserRoleAssignment[];
};

/**
 * One page of CAMS users. `name` and `email` filter by case-insensitive contains, combined with AND.
 */
export type CamsUsersPredicate = {
  limit: number;
  offset: number;
  name?: string;
  email?: string;
};

export type CamsUserWithPermissions = CamsUserReference & {
  permissions: UserRoleAssignment[];
};

const ANY_SCOPE = '*';

/**
 * The key a unique {userId, activeKey} index uses to reject exact duplicate active assignments.
 *
 * The index does not look at `active`, so deactivating an assignment replaces its activeKey with
 * inactiveKeyFor(id). Otherwise granting the same role and scope again collides with the inactive
 * record.
 */
export function activeKeyFor(
  role: CamsRoleType,
  regionId: string | null,
  officeCode: string | null,
): string {
  return [role, regionId ?? ANY_SCOPE, officeCode ?? ANY_SCOPE].join('|');
}

/** The activeKey of a deactivated assignment: unique to it, so it never blocks a new grant. */
export function inactiveKeyFor(assignmentId: string): string {
  return `inactive|${assignmentId}`;
}

/**
 * The document for a new, active permission. The caller supplies its id (a random UUID) and the
 * time, so every writer (the access use case, the dev-tools superuser command) builds the same
 * shape.
 */
export function newRoleAssignment(grant: {
  id: string;
  user: CamsUserReference;
  role: CamsRoleType;
  scope: PermissionScope;
  assignedBy: CamsUserReference;
  assignedAt: string;
}): UserRoleAssignment {
  const { id, user, role, scope, assignedBy, assignedAt } = grant;
  return {
    documentType: 'USER_ROLE_ASSIGNMENT',
    id,
    userId: user.id,
    userName: user.name,
    ...(user.email ? { email: user.email } : {}),
    role,
    regionId: scope.regionId,
    officeCode: scope.officeCode,
    assignedBy: assignedBy.id,
    assignedByName: assignedBy.name,
    assignedAt,
    expiresAt: null,
    active: true,
    activeKey: activeKeyFor(role, scope.regionId, scope.officeCode),
  };
}

/** The fields that deactivate a permission. It is never deleted; its activeKey is freed. */
export function deactivationOf(assignment: Pick<UserRoleAssignment, 'id'>) {
  return { active: false, activeKey: inactiveKeyFor(assignment.id) };
}

/** A permission's role, scope and active flag, as an audit entry records them. */
export function roleAssignmentState(assignment: UserRoleAssignment): RoleAssignmentState {
  const { role, regionId, officeCode, active } = assignment;
  return { role, regionId, officeCode, active };
}

/** The audit entry for one change to a permission. The caller supplies its id and the time. */
export function roleAssignmentAuditEntry(change: {
  id: string;
  action: RoleAssignmentAuditEntry['action'];
  assignment: UserRoleAssignment;
  previousState: RoleAssignmentState | null;
  newState: RoleAssignmentState;
  performer: CamsUserReference;
  performedAt: string;
  replacedByAssignmentId: string | null;
}): RoleAssignmentAuditEntry {
  const { assignment, newState, performer } = change;
  // The top-level role and scope are read from the new state so the two can't disagree.
  const { role, regionId, officeCode } = newState;
  return {
    documentType: 'ROLE_ASSIGNMENT_AUDIT',
    id: change.id,
    assignmentId: assignment.id,
    action: change.action,
    userId: assignment.userId,
    userName: assignment.userName,
    role,
    regionId,
    officeCode,
    performedBy: performer.id,
    performedByName: performer.name,
    performedAt: change.performedAt,
    previousState: change.previousState,
    newState,
    replacedByAssignmentId: change.replacedByAssignmentId,
  };
}

// Every CAMS role can be granted. (CamsRoles already leaves out PrivilegedIdentityUser.)
export const grantableRoles = [...CamsRoles];

/**
 * Where a permission applies: one office (both set), a whole region (office null), or every region
 * (both null). Super User permissions are always every region.
 */
export type PermissionScope = { regionId: string | null; officeCode: string | null };

export function scopeContains(outer: PermissionScope, inner: PermissionScope): boolean {
  if (outer.regionId === null) return true;
  if (outer.regionId !== inner.regionId) return false;
  return outer.officeCode === null || outer.officeCode === inner.officeCode;
}

/**
 * Whether one scope contains the other. For the same user and role, a new grant replaces every
 * active permission whose scope overlaps it, broader or narrower.
 */
export function scopesOverlap(a: PermissionScope, b: PermissionScope): boolean {
  return scopeContains(a, b) || scopeContains(b, a);
}

/**
 * "All Regions", "Region 2 - All Offices" or "Region 2 - Manhattan" (the office code if the name is
 * missing or empty). Used for both the Region and Office picker and the replaced-permission alert,
 * so the two always agree (UX-confirmed wording, 2026-11-09).
 */
export function scopeLabel(scope: PermissionScope, officeName?: string): string {
  if (scope.regionId === null) return 'All Regions';
  return `Region ${scope.regionId} - ${scope.officeCode === null ? 'All Offices' : officeName || scope.officeCode}`;
}

// Rejects non-strings, empty strings and whitespace-only strings.
const NOT_BLANK = /\S/;

export const roleAssignmentGrantRequestSpec: ValidationSpec<RoleAssignmentGrantRequest> = {
  userId: [V.matches(NOT_BLANK, 'A user is required')],
  role: [V.isInSet<CamsRoleType>(grantableRoles, 'A valid role is required')],
  regionId: [V.matches(NOT_BLANK, 'A region is required')],
  officeCode: [V.matches(NOT_BLANK, 'An office is required')],
};
