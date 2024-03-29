import { AttorneyGatewayInterface } from './attorney.gateway.interface';
import { AttorneyListDbResult } from '../adapters/types/attorneys';
import { ApplicationContext } from '../adapters/types/basic';
import { getAttorneyGateway } from '../factory';
import { CaseAssignmentUseCase } from './case.assignment';
import { Attorney } from '../adapters/types/attorney.class';
import { getFullName } from '../../../../common/src/name-helper';

const MODULE_NAME = 'ATTORNEYS-USE-CASE';

export default class AttorneysList {
  gateway: AttorneyGatewayInterface;

  constructor(gateway?: AttorneyGatewayInterface) {
    if (!gateway) {
      this.gateway = getAttorneyGateway();
    } else {
      this.gateway = gateway;
    }
  }

  async getAttorneyList(
    applicationContext: ApplicationContext,
    fields: { officeId?: string },
  ): Promise<AttorneyListDbResult> {
    const assignmentsUseCase = new CaseAssignmentUseCase(applicationContext);
    const attorneys = await this.gateway.getAttorneys(applicationContext, fields);

    const attorneysWithCaseLoad = [];

    for (const atty of attorneys.body.attorneyList) {
      const attorney = new Attorney(atty);
      try {
        attorney.caseLoad = await assignmentsUseCase.getCaseLoad(getFullName(attorney));
      } catch (e) {
        applicationContext.logger.error(MODULE_NAME, 'Unable to retrieve attorney case load.', e);
      }
      attorneysWithCaseLoad.push(attorney.getAsObjectKeyVal());
    }

    attorneys.body.attorneyList = attorneysWithCaseLoad;
    return attorneys;
  }
}
