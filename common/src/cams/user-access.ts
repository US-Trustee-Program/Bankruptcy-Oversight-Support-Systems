import { CamsRole, CamsRoles, CamsRoleType } from './roles';
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

/**
 * A request to grant a role in one office. The server derives regionId from the office.
 */
export type RoleAssignmentGrantRequest = {
  userId: string;
  role: CamsRoleType;
  officeCode: string;
  reason: string;
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
 */
export function activeKeyFor(
  role: CamsRoleType,
  regionId: string | null,
  officeCode: string | null,
): string {
  return [role, regionId ?? ANY_SCOPE, officeCode ?? ANY_SCOPE].join('|');
}

export const ROLE_ASSIGNMENT_REASON_MAX_LENGTH = 1000;

// Super User grants are enabled in a later slice.
const grantableRoles = CamsRoles.filter((role) => role !== CamsRole.SuperUser);

// Rejects non-strings, empty strings and whitespace-only strings.
const NOT_BLANK = /\S/;

export const roleAssignmentGrantRequestSpec: ValidationSpec<RoleAssignmentGrantRequest> = {
  userId: [V.matches(NOT_BLANK, 'A user is required')],
  role: [V.isInSet<CamsRoleType>(grantableRoles, 'A valid role is required')],
  officeCode: [V.matches(NOT_BLANK, 'An office is required')],
  // The length limit applies to the trimmed reason, which is what gets stored.
  reason: [
    V.checkFirst(V.matches(NOT_BLANK, 'A reason is required')).then(
      V.trimmed(V.maxLength(ROLE_ASSIGNMENT_REASON_MAX_LENGTH)),
    ),
  ],
};
