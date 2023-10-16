import { ApplicationContext } from '../types/basic';
import AttorneysList from '../../use-cases/attorneys';
import log from '../services/logger.service';
import { AttorneyListDbResult } from '../types/attorneys';

const MODULE_NAME = 'ATTORNEYS-CONTROLLER';

export class AttorneysController {
  private readonly context: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.context = context;
  }

  public async getAttorneyList(requestQueryFilters: {
    officeId?: string;
  }): Promise<AttorneyListDbResult> {
    log.info(this.context, MODULE_NAME, 'Getting Attorneys list.');
    const attorneysList = new AttorneysList();
    return await attorneysList.getAttorneyList(this.context, requestQueryFilters);
  }
}
