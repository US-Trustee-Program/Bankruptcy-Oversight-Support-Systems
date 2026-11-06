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
 * An append-only record of a change to a UserRoleAssignment.
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
  reason: string;
};

/** The path segment that stands for every region or every office in a grant. */
export const ALL_SCOPE = 'all';

/**
 * A grant, as sent to PUT /user-access/users/:userId/permissions/:role/:regionId/:officeCode with
 * the reason in the body. `regionId` and `officeCode` are ALL_SCOPE for every region or office.
 * Granting a permission the user already holds changes nothing.
 */
export type RoleAssignmentGrantRequest = {
  userId: string;
  role: CamsRoleType;
  regionId: string;
  officeCode: string;
  reason: string;
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

export const ROLE_ASSIGNMENT_REASON_MAX_LENGTH = 1000;

// Every CAMS role can be granted. (CamsRoles already leaves out PrivilegedIdentityUser.)
export const grantableRoles = [...CamsRoles];

/**
 * Where a permission applies: one office (both set), a whole region (office null), or every region
 * (both null). Super User permissions are always every region.
 */
export type PermissionScope = { regionId: string | null; officeCode: string | null };

function scopeContains(outer: PermissionScope, inner: PermissionScope): boolean {
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

/** "All regions", "Region 2, All" or "Region 2, Manhattan" (the office code if no name is known). */
export function scopeLabel(scope: PermissionScope, officeName?: string): string {
  if (scope.regionId === null) return 'All regions';
  return `Region ${scope.regionId}, ${scope.officeCode === null ? 'All' : (officeName ?? scope.officeCode)}`;
}

// Rejects non-strings, empty strings and whitespace-only strings.
const NOT_BLANK = /\S/;

export const roleAssignmentGrantRequestSpec: ValidationSpec<RoleAssignmentGrantRequest> = {
  userId: [V.matches(NOT_BLANK, 'A user is required')],
  role: [V.isInSet<CamsRoleType>(grantableRoles, 'A valid role is required')],
  regionId: [V.matches(NOT_BLANK, 'A region is required')],
  officeCode: [V.matches(NOT_BLANK, 'An office is required')],
  // The length limit applies to the trimmed reason, which is what gets stored.
  reason: [
    V.checkFirst(V.matches(NOT_BLANK, 'A reason is required')).then(
      V.trimmed(V.maxLength(ROLE_ASSIGNMENT_REASON_MAX_LENGTH)),
    ),
  ],
};
