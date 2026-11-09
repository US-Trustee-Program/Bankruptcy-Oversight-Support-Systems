import { CamsRole, CamsRoleType } from '@common/cams/roles';
import { UstpOfficeDetails } from '@common/cams/offices';
import { UserRoleAssignment } from '@common/cams/user-access';

export type SessionAccess = { roles: CamsRoleType[]; offices: UstpOfficeDetails[] };

/**
 * The roles and offices a session gets from a user's permissions, expanded from the live office
 * list: one office gives that office (if it still exists), a whole region every office currently in
 * it, every region every office, and Super User the role with no offices. Roles and offices are
 * merged across permissions, each once; inactive permissions are ignored.
 */
export function sessionAccessFrom(
  permissions: UserRoleAssignment[],
  offices: UstpOfficeDetails[],
): SessionAccess {
  const roles = new Set<CamsRoleType>();
  const granted = new Map<string, UstpOfficeDetails>();

  for (const permission of permissions) {
    if (!permission.active) continue;
    roles.add(permission.role);
    if (permission.role === CamsRole.SuperUser) continue;
    for (const office of offices) {
      if (covers(permission, office)) granted.set(office.officeCode, office);
    }
  }

  return { roles: [...roles], offices: offices.filter((o) => granted.has(o.officeCode)) };
}

function covers(permission: UserRoleAssignment, office: UstpOfficeDetails): boolean {
  if (permission.regionId === null) return true;
  if (permission.regionId !== office.regionId) return false;
  return permission.officeCode === null || permission.officeCode === office.officeCode;
}
