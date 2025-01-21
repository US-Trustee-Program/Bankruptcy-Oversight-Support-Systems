import { CamsUser, PrivilegedIdentityUser } from '../../../../common/src/cams/users';
import { getUserGroupGateway, getUsersRepository } from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsRole } from '../../../../common/src/cams/roles';
import { UstpOfficeDetails } from '../../../../common/src/cams/offices';
import { getOfficesFromGroupNames, getRolesFromGroupNames } from '../user-session/user-session';

export type PrivilegedIdentityHelperOptions = {
  idpUser?: CamsUser;
  pimUser?: PrivilegedIdentityUser;
};

const MODULE_NAME = 'USERS-HELPERS';

async function getPrivilegedIdentityUser(
  context: ApplicationContext,
  userId: string,
  options?: PrivilegedIdentityHelperOptions,
): Promise<CamsUser> {
  const idpUser: Partial<CamsUser> = options?.idpUser ?? {};
  let pimUser: Partial<PrivilegedIdentityUser> = options?.pimUser ?? {};
  const combined: CamsUser = {
    id: userId,
    name: idpUser.name ?? '',
    roles: idpUser.roles ?? [],
    offices: idpUser.offices ?? [],
  };

  if (!idpUser.id) {
    const userGroupGateway = await getUserGroupGateway(context);
    const user = await userGroupGateway.getUserById(context, userId);
    if (!user.roles.includes(CamsRole.PrivilegedIdentityUser)) return user;

    combined.name = user.name;
    combined.roles = user.roles;
    combined.offices = user.offices;
  }

  try {
    if (!pimUser.id) {
      const usersRepository = getUsersRepository(context);
      pimUser = await usersRepository.getPrivilegedIdentityUser(combined.id);
    }
    if (new Date() < new Date(pimUser.expires)) {
      const roles = getRolesFromGroupNames(pimUser.claims.groups);
      const rolesSet = new Set<CamsRole>([...combined.roles, ...roles]);

      const offices = await getOfficesFromGroupNames(context, pimUser.claims.groups);
      const officeSet = new Set<UstpOfficeDetails>([...combined.offices, ...offices]);
      combined.roles = Array.from(rolesSet);
      combined.offices = Array.from(officeSet);
    }
  } catch (error) {
    // Whether there is no document or we encountered an error, we just return the IDP user.
    context.logger.error(
      MODULE_NAME,
      `Failed to elevate permissions for user ${combined.name} (${combined.id}).`,
      error.message,
    );
  }

  return combined;
}

const UsersHelpers = { getPrivilegedIdentityUser };

export default UsersHelpers;
