import { CamsRole, CamsRoleType } from '@common/cams/roles';
import { UstpOfficeDetails } from '@common/cams/offices';
import { scopeContains, UserRoleAssignment } from '@common/cams/user-access';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';

export type SessionAccess = { roles: CamsRoleType[]; offices: UstpOfficeDetails[] };

/**
 * The roles and offices a session gets from a user's permissions, expanded from the live office
 * list: one office gives that office (if it still exists), a whole region every office currently in
 * it, every region every office, and Super User the role with no offices. Roles and offices are
 * merged across permissions, each once. The repository returns only active permissions.
 */
export function sessionAccessFrom(
  permissions: UserRoleAssignment[],
  offices: UstpOfficeDetails[],
): SessionAccess {
  const roles = new Set<CamsRoleType>();
  const grantedOfficeCodes = new Set<string>();

  for (const permission of resolveOverlaps(permissions)) {
    roles.add(permission.role);
    if (permission.role === CamsRole.SuperUser) continue;
    for (const office of offices) {
      if (scopeContains(permission, office)) grantedOfficeCodes.add(office.officeCode);
    }
  }

  return {
    roles: [...roles],
    offices: offices.filter((o) => grantedOfficeCodes.has(o.officeCode)),
  };
}

/**
 * Drops any permission that a narrower active permission for the same role already supersedes.
 *
 * `grantPermission` creates a narrower replacement before deactivating the broader permission(s) it
 * overlaps; if a login reads between those two writes, or the deactivation fails, the broader
 * permission is still active alongside its replacement. Without this, the broader permission would
 * union its scope into the session even though the grant intended to replace it.
 */
function resolveOverlaps(permissions: UserRoleAssignment[]): UserRoleAssignment[] {
  return permissions.filter(
    (permission) =>
      !permissions.some(
        (other) =>
          other.role === permission.role &&
          scopeContains(permission, other) &&
          !scopeContains(other, permission),
      ),
  );
}

/**
 * Reads the user's active permissions and the office list in parallel. Either read failing fails
 * the whole read; the caller decides whether to retry or deny the session.
 */
export async function readSessionAccess(
  context: ApplicationContext,
  userId: string,
): Promise<{ access: SessionAccess; permissionCount: number }> {
  const [permissions, offices] = await Promise.all([
    factory.getUserRoleAssignmentRepository(context).findActiveByUserIds([userId]),
    factory.getOfficesGateway(context).getOffices(context),
  ]);
  return {
    access: sessionAccessFrom(permissions, offices),
    permissionCount: permissions.length,
  };
}
