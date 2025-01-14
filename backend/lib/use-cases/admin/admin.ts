import { ApplicationContext } from '../../adapters/types/basic';
import Factory, { getUserGroupGateway, getUsersRepository } from '../../factory';
import { getCamsError, getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { CamsUserGroup, CamsUserReference, Staff } from '../../../../common/src/cams/users';
import { AugmentableUser, UpsertResult } from '../gateways.types';
import { DEFAULT_STAFF_TTL } from '../offices/offices';
import { CamsRole } from '../../../../common/src/cams/roles';
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

  // TODO: Expose this through the web API to drive drop down in the UI.
  public async getAugmentableUsers(context: ApplicationContext): Promise<CamsUserReference[]> {
    try {
      const groupName = LocalStorageGateway.getAugmentableUserRoleGroupName();
      const groupsGateway = getUserGroupGateway(context);
      const group = await groupsGateway.getUserGroupWithUsers(
        context,
        context.config.userGroupGatewayConfig,
        groupName,
      );
      return group.users!.map((user) => getCamsUserReference(user));
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to get augmentable users.');
    }
  }

  public async augmentUser(
    context: ApplicationContext,
    userId: string,
    options: { roles?: CamsRole[]; officeCodes?: string[]; expires?: string },
  ) {
    const notAugmentableUserError = new BadRequestError(MODULE_NAME, {
      message: 'User does not have permission to be augmented.',
    });

    try {
      const groupName = LocalStorageGateway.getAugmentableUserRoleGroupName();
      const groupsGateway = getUserGroupGateway(context);
      const augmentableUserGroup: CamsUserGroup = await groupsGateway.getUserGroupWithUsers(
        context,
        context.config.userGroupGatewayConfig,
        groupName,
      );

      if (!augmentableUserGroup.users || !augmentableUserGroup.users.length) {
        notAugmentableUserError.camsStack.push({
          module: MODULE_NAME,
          message: 'Augmentable group does not contain any users.',
        });
        throw notAugmentableUserError;
      }

      const user = augmentableUserGroup.users.find((user) => user.id === userId);

      if (!user) {
        notAugmentableUserError.camsStack.push({
          module: MODULE_NAME,
          message: `User ID ${userId} is not contained in the augmentable user group.`,
        });
        throw notAugmentableUserError;
      }

      const userReference = getCamsUserReference(user);
      const augmentableUser: AugmentableUser = {
        documentType: 'AUGMENTABLE_USER',
        ...userReference,
        ...options,
      };
      const usersRepo = getUsersRepository(context);
      const result = await usersRepo.putAugmentableUser(augmentableUser);

      if (result.upsertedCount === 0 && result.modifiedCount === 0) {
        throw new UnknownError(MODULE_NAME, { message: 'Failed to add augmentable user.' });
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to augment user.');
    }
  }
}
