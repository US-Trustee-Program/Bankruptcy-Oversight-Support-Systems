import { AttorneyGatewayInterface } from './attorney.gateway.interface';
import { AttorneyListDbResult } from '../adapters/types/attorneys';
import { ApplicationContext } from '../adapters/types/basic';
import { getAttorneyGateway } from '../factory';
import { CaseAssignmentUseCase } from './case.assignment';

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

    for (const atty of attorneys.body.attorneyList) {
      try {
        // TODO: Assignments use case needs to be updated to use a user ID rather than a name.
        atty.caseLoad = await assignmentsUseCase.getCaseLoad(atty.name);
      } catch (e) {
        applicationContext.logger.error(MODULE_NAME, 'Unable to retrieve attorney case load.', e);
      }
    }

    return attorneys;
  }
}
