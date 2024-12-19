import { ApplicationContext } from '../../adapters/types/basic';
import Factory from '../../factory';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';

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
}
