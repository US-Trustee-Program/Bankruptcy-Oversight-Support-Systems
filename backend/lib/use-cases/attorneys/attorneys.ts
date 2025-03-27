import { AttorneyGatewayInterface } from './attorney.gateway.interface';
import { ApplicationContext } from '../../adapters/types/basic';
import { getAttorneyGateway } from '../../factory';
import { CaseAssignmentUseCase } from '../case-assignment/case-assignment';
import { AttorneyUser } from '../../../../common/src/cams/users';

const MODULE_NAME = 'ATTORNEYS-USE-CASE';

export default class AttorneysList {
  gateway: AttorneyGatewayInterface;

  constructor() {
    this.gateway = getAttorneyGateway();
  }

  async getAttorneyList(applicationContext: ApplicationContext): Promise<Array<AttorneyUser>> {
    const assignmentsUseCase = new CaseAssignmentUseCase(applicationContext);
    const attorneys = await this.gateway.getAttorneys(applicationContext);

    for (const atty of attorneys) {
      try {
        atty.caseLoad = await assignmentsUseCase.getCaseLoad(atty.id);
      } catch (e) {
        applicationContext.logger.error(MODULE_NAME, 'Unable to retrieve attorney case load.', e);
      }
    }

    return attorneys;
  }
}
