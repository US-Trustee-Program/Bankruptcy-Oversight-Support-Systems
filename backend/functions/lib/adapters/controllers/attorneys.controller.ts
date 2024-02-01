import { ApplicationContext } from '../types/basic';
import AttorneysList from '../../use-cases/attorneys';
import { AttorneyListDbResult } from '../types/attorneys';

const MODULE_NAME = 'ATTORNEYS-CONTROLLER';

export class AttorneysController {
  private readonly applicationContext: ApplicationContext;

  constructor(applicationContext: ApplicationContext) {
    this.applicationContext = applicationContext;
  }

  public async getAttorneyList(requestQueryFilters: {
    officeId?: string;
  }): Promise<AttorneyListDbResult> {
    this.applicationContext.logger.info(MODULE_NAME, 'Getting Attorneys list.');
    const attorneysList = new AttorneysList();
    return await attorneysList.getAttorneyList(this.applicationContext, requestQueryFilters);
  }
}
