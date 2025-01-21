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

async function getPrivilegedIdentityUser(
  context: ApplicationContext,
  userId: string,
  options?: PrivilegedIdentityHelperOptions,
) {
  if (!options) {
    const userGroupGateway = await getUserGroupGateway(context);
    const user = await userGroupGateway.getUserById(context, userId);

    const combined = { roles: user.roles, offices: user.offices };

    const usersRepository = getUsersRepository(context);
    const pimUser = await usersRepository.getPrivilegedIdentityUser(user.id);
    if (new Date() < new Date(pimUser.expires)) {
      const roles = getRolesFromGroupNames(pimUser.claims.groups);
      const rolesSet = new Set<CamsRole>([...user.roles, ...roles]);

      const offices = await getOfficesFromGroupNames(context, pimUser.claims.groups);
      const officeSet = new Set<UstpOfficeDetails>([...user.offices, ...offices]);
      combined.roles = Array.from(rolesSet);
      combined.offices = Array.from(officeSet);
    }

    return combined;
  }
}

const UsersHelpers = { getPrivilegedIdentityUser };

export default UsersHelpers;
