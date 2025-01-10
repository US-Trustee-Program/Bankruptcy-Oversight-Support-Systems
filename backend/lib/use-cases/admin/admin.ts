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
        camsStackInfo: { module: MODULE_NAME, message: 'Failed to create document.' },
      });
    }
  }
}
