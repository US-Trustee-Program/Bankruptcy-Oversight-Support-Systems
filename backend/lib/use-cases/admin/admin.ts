import { ApplicationContext } from '../../adapters/types/basic';
import Factory from '../../factory';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { Staff } from '../../../../common/src/cams/users';

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
  ): Promise<void> {
    const officesRepo = Factory.getOfficesRepository(context);
    const ttl = requestBody.ttl ?? 86400;
    const userWithRoles: Staff = {
      id: requestBody.id,
      name: requestBody.name,
      roles: requestBody.roles,
    };

    try {
      await officesRepo.putOfficeStaff(requestBody.officeCode, userWithRoles, ttl);
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
}
