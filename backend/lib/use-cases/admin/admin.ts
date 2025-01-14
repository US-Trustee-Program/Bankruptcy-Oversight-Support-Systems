import { ApplicationContext } from '../../adapters/types/basic';
import Factory, { getOfficesGateway, getUserGroupGateway, getUsersRepository } from '../../factory';
import { getCamsError, getCamsErrorWithStack } from '../../common-errors/error-utilities';
import {
  PrivilegedIdentityUser,
  CamsUserGroup,
  CamsUserReference,
  Staff,
} from '../../../../common/src/cams/users';
import { UpsertResult } from '../gateways.types';
import { DEFAULT_STAFF_TTL } from '../offices/offices';
import { getCamsUserReference } from '../../../../common/src/cams/session';
import { BadRequestError } from '../../common-errors/bad-request';
import LocalStorageGateway from '../../adapters/gateways/storage/local-storage-gateway';
import { UnknownError } from '../../common-errors/unknown-error';

const MODULE_NAME = 'ADMIN-USE-CASE';

export type CreateStaffRequestBody = Staff & {
  officeCode: string;
  ttl?: number;
};

export class AdminUseCase {
  private privilegedIdentityClaimGroups: string[];

  public async deleteMigrations(context: ApplicationContext): Promise<void> {
    try {
      const casesRepo = Factory.getCasesRepository(context);
      return await casesRepo.deleteMigrations();
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: { module: MODULE_NAME, message: 'Failed during migration deletion.' },
      });
    }
  }

  /**
   * addOfficeStaff
   * @template {T extends CamsError}
   * @param {ApplicationContext} context Application context.
   * @param {CreateStaffRequestBody} requestBody Request must include the office code, the user's
   * id, the user's name, and the roles they have. Optionally provide a Mongo-compliant ttl. If not
   * provided, ttl defaults to 24 hours. For no ttl, provide -1.
   * @throws {T} Throws a CamsError or any type that extends CamsError.
   */
  public async addOfficeStaff(
    context: ApplicationContext,
    requestBody: CreateStaffRequestBody,
  ): Promise<UpsertResult> {
    const officesRepo = Factory.getOfficesRepository(context);
    const ttl = requestBody.ttl ?? DEFAULT_STAFF_TTL;
    const userWithRoles: Staff = {
      id: requestBody.id,
      name: requestBody.name,
      roles: requestBody.roles,
    };

    try {
      return await officesRepo.putOfficeStaff(requestBody.officeCode, userWithRoles, ttl);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: { module: MODULE_NAME, message: 'Failed to create staff document.' },
      });
    }
  }

  public async deleteStaff(
    context: ApplicationContext,
    officeCode: string,
    id: string,
  ): Promise<void> {
    const officesRepo = Factory.getOfficesRepository(context);

    try {
      await officesRepo.findAndDeleteStaff(officeCode, id);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: { module: MODULE_NAME, message: 'Failed to delete staff document.' },
      });
    }
  }

  // TODO: Expose the PrivilegedIdentityUser functions through the web API to drive drop down in the UI.
  public async getPrivilegedIdentityClaimGroups(context: ApplicationContext): Promise<string[]> {
    // TODO: We could just query the Okta API for the group names, but we would have to refactor the CamsGroup to return the underlying IdP group name.
    try {
      if (!this.privilegedIdentityClaimGroups) {
        const officeGateway = getOfficesGateway(context);

        const offices = await officeGateway.getOffices(context);
        const officeGroups = offices.map((office) => office.idpGroupId);
        const roleGroups = Array.from(LocalStorageGateway.getRoleMapping().keys());
        this.privilegedIdentityClaimGroups = [...officeGroups, ...roleGroups];
      }

      return this.privilegedIdentityClaimGroups;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async getPrivilegedIdentityUsers(
    context: ApplicationContext,
  ): Promise<CamsUserReference[]> {
    try {
      const groupName = LocalStorageGateway.getPrivilegedIdentityUserRoleGroupName();
      const groupsGateway = getUserGroupGateway(context);
      const group = await groupsGateway.getUserGroupWithUsers(
        context,
        context.config.userGroupGatewayConfig,
        groupName,
      );
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

  public async augmentUser(
    context: ApplicationContext,
    userId: string,
    options: { groups: string[]; expires?: string },
  ) {
    const notPrivilegedIdentityUserError = new BadRequestError(MODULE_NAME, {
      message: 'User does not have permission to be augmented.',
    });

    try {
      const groupName = LocalStorageGateway.getPrivilegedIdentityUserRoleGroupName();
      const groupsGateway = getUserGroupGateway(context);
      const privilegedIdentityUserGroup: CamsUserGroup = await groupsGateway.getUserGroupWithUsers(
        context,
        context.config.userGroupGatewayConfig,
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
      const usersRepo = getUsersRepository(context);
      const result = await usersRepo.putPrivilegedIdentityUser(privilegedIdentityUser);

      if (result.upsertedCount === 0 && result.modifiedCount === 0) {
        throw new UnknownError(MODULE_NAME, { message: 'Failed to add privileged identity user.' });
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to augment user.');
    }
  }
}
