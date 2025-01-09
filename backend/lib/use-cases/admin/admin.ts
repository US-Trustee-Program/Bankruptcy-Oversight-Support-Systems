import { ApplicationContext } from '../../adapters/types/basic';
import Factory from '../../factory';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { Staff } from '../../../../common/src/cams/users';

const MODULE_NAME = 'ADMIN-USE-CASE';

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
   * @param {ApplicationContext} context Application context.
   * @param {string} officeCode The AD Group for the office to add the user to.
   * @param {Staff} userWithRoles User name, id, and list of roles.
   * @param {number} [ttl=86400] Mongo-compliant time to live with a default of 24 hours. Use -1 for
   * no ttl.
   * @throws {CamsError} Throws a CamsError or any type that extends CamsError.
   */
  public async addOfficeStaff(
    context: ApplicationContext,
    officeCode: string,
    userWithRoles: Staff,
    ttl: number = 86400,
  ): Promise<void> {
    const officesRepo = Factory.getOfficesRepository(context);

    try {
      await officesRepo.putOfficeStaff(officeCode, userWithRoles, ttl);
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
