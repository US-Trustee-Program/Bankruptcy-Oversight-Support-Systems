import { ApplicationContext } from '../../adapters/types/basic';
import Factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';

const MODULE_NAME = 'ADMIN-USE-CASE';

export class AdminUseCase {
  private readonly context: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.context = context;
  }

  public async deleteMigrations(): Promise<void> {
    try {
      const casesRepo = Factory.getCasesRepository(this.context);
      casesRepo.deleteMigrations();
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, '');
    }

    throw new Error('Method not implemented.');
  }
}
