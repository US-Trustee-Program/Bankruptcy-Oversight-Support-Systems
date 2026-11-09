import { CamsRole, CamsRoleType } from '@common/cams/roles';
import { UstpOfficeDetails } from '@common/cams/offices';
import { UserRoleAssignment } from '@common/cams/user-access';
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

  for (const permission of permissions) {
    roles.add(permission.role);
    if (permission.role === CamsRole.SuperUser) continue;
    for (const office of offices) {
      if (covers(permission, office)) grantedOfficeCodes.add(office.officeCode);
    }
  }

  return {
    roles: [...roles],
    offices: offices.filter((o) => grantedOfficeCodes.has(o.officeCode)),
  };
}

function covers(permission: UserRoleAssignment, office: UstpOfficeDetails): boolean {
  if (permission.regionId === null) return true;
  if (permission.regionId !== office.regionId) return false;
  return permission.officeCode === null || permission.officeCode === office.officeCode;
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
