import { CamsUser, PrivilegedIdentityUser } from '@common/cams/users';
import Factory from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsRole, CamsRoleType } from '@common/cams/roles';
import { UstpOfficeDetails } from '@common/cams/offices';
import LocalStorageGateway from '../../adapters/gateways/storage/local-storage-gateway';

type PrivilegedIdentityHelperOptions = {
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

  if (!options?.idpUser) {
    const userGroupGateway = await Factory.getUserGroupGateway(context);
    const user = await userGroupGateway.getUserById(context, userId);
    if (!user.roles.includes(CamsRole.PrivilegedIdentityUser)) return user;

    combined.name = user.name;
    combined.roles = user.roles;
    combined.offices = user.offices;
  }

  if (!context.featureFlags['privileged-identity-management']) return combined;

  try {
    if (!options?.pimUser) {
      const usersRepository = Factory.getUsersRepository(context);
      pimUser = await usersRepository.getPrivilegedIdentityUser(combined.id);
    }
    if (new Date() < new Date(pimUser.expires)) {
      const roles = getRolesFromGroupNames(pimUser.claims.groups);
      const rolesSet = new Set<CamsRoleType>([...combined.roles, ...roles]);

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

function getRolesFromGroupNames(idpGroups: string[]): CamsRoleType[] {
  const rolesMap = LocalStorageGateway.getRoleMapping();
  return idpGroups.filter((group) => rolesMap.has(group)).map((group) => rolesMap.get(group));
}

async function getOfficesFromGroupNames(
  context: ApplicationContext,
  idpGroups: string[],
): Promise<UstpOfficeDetails[]> {
  const officesGateway = Factory.getOfficesGateway(context);
  const ustpOffices = await officesGateway.getOffices(context);
  return ustpOffices.filter((office) => idpGroups.includes(office.idpGroupName));
}

const UsersHelpers = {
  getPrivilegedIdentityUser,
  getRolesFromGroupNames,
  getOfficesFromGroupNames,
};

export default UsersHelpers;
