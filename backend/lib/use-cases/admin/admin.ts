import { ApplicationContext } from '../../adapters/types/basic';
import Factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { PrivilegedIdentityUser, CamsUserGroup, CamsUserReference } from '@common/cams/users';
import { getCamsUserReference } from '@common/cams/session';
import { BadRequestError } from '../../common-errors/bad-request';
import LocalStorageGateway from '../../adapters/gateways/storage/local-storage-gateway';
import { UnknownError } from '../../common-errors/unknown-error';
import UsersHelpers from '../users/users.helpers';

const MODULE_NAME = 'ADMIN-USE-CASE';

type RoleAndOfficeGroupNames = {
  roles: string[];
  offices: string[];
};
export class AdminUseCase {
  private roleAndOfficeGroupNames: RoleAndOfficeGroupNames;

  public async getRoleAndOfficeGroupNames(
    context: ApplicationContext,
  ): Promise<RoleAndOfficeGroupNames> {
    try {
      if (!this.roleAndOfficeGroupNames) {
        const officeGateway = Factory.getOfficesGateway(context);

        const offices = await officeGateway.getOffices(context);
        const officeGroups = offices.map((office) => office.idpGroupName);
        const roleGroups = Array.from(LocalStorageGateway.getRoleMapping().keys());

        this.roleAndOfficeGroupNames = {
          roles: roleGroups,
          offices: officeGroups,
        };
      }

      return this.roleAndOfficeGroupNames;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async getPrivilegedIdentityUsers(
    context: ApplicationContext,
  ): Promise<CamsUserReference[]> {
    try {
      const groupName = LocalStorageGateway.getPrivilegedIdentityUserRoleGroupName();
      const groupsGateway = await Factory.getUserGroupGateway(context);
      const group = await groupsGateway.getUserGroupWithUsers(context, groupName);
      return group.users!.map((user) => getCamsUserReference(user));
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to get privileged identity users.');
    }
  }

  public async getPrivilegedIdentityUser(
    context: ApplicationContext,
    userId: string,
  ): Promise<PrivilegedIdentityUser> {
    try {
      const gateway = Factory.getUsersRepository(context);
      return await gateway.getPrivilegedIdentityUser(userId);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async deletePrivilegedIdentityUser(
    context: ApplicationContext,
    userId: string,
  ): Promise<void> {
    try {
      const gateway = Factory.getUsersRepository(context);
      await gateway.deletePrivilegedIdentityUser(userId);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async elevatePrivilegedUser(
    context: ApplicationContext,
    userId: string,
    updatedBy: CamsUserReference,
    options: { groups: string[]; expires: string },
  ) {
    const notPrivilegedIdentityUserError = new BadRequestError(MODULE_NAME, {
      message: 'User does not have privileged identity permission.',
    });

    if (!options.expires || new Date() > new Date(options.expires)) {
      throw new BadRequestError(
        'User privilege elevation must have an expiration date in the future.',
      );
    }

    try {
      const groupName = LocalStorageGateway.getPrivilegedIdentityUserRoleGroupName();
      const groupsGateway = await Factory.getUserGroupGateway(context);
      const privilegedIdentityUserGroup: CamsUserGroup = await groupsGateway.getUserGroupWithUsers(
        context,
        groupName,
      );

      if (!privilegedIdentityUserGroup.users || !privilegedIdentityUserGroup.users.length) {
        notPrivilegedIdentityUserError.camsStack.push({
          module: MODULE_NAME,
          message: 'Privileged Identity group does not contain any users.',
        });
        throw notPrivilegedIdentityUserError;
      }

      const user = privilegedIdentityUserGroup.users.find((user) => user.id === userId);

      if (!user) {
        notPrivilegedIdentityUserError.camsStack.push({
          module: MODULE_NAME,
          message: `User ID ${userId} is not contained in the privileged identity user group.`,
        });
        throw notPrivilegedIdentityUserError;
      }

      const userReference = getCamsUserReference(user);
      const privilegedIdentityUser: PrivilegedIdentityUser = {
        documentType: 'PRIVILEGED_IDENTITY_USER',
        ...userReference,
        claims: {
          groups: options.groups,
        },
        expires: options.expires,
      };
      const usersRepo = Factory.getUsersRepository(context);
      const result = await usersRepo.putPrivilegedIdentityUser(privilegedIdentityUser, updatedBy);

      if (result.upsertedCount === 0 && result.modifiedCount === 0) {
        throw new UnknownError(MODULE_NAME, { message: 'Failed to add privileged identity user.' });
      }

      const officesRepo = Factory.getOfficesRepository(context);
      const offices = await UsersHelpers.getOfficesFromGroupNames(
        context,
        privilegedIdentityUser.claims.groups,
      );
      for (const office of offices) {
        const roles = UsersHelpers.getRolesFromGroupNames(privilegedIdentityUser.claims.groups);
        const staff = { ...userReference, roles };
        await officesRepo.putOrExtendOfficeStaff(office.officeCode, staff, options.expires);
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to add privileged identity user.');
    }
  }
}
