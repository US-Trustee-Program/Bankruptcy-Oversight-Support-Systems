import { AttorneyGatewayInterface } from './attorney.gateway.interface';
import { AttorneyListDbResult } from '../adapters/types/attorneys';
import { ApplicationContext } from '../adapters/types/basic';
import { getAttorneyGateway } from '../factory';
import { CaseAssignment } from './case.assignment';
import { Attorney } from '../adapters/types/attorney.class';
import { getFullName } from '../../../../common/src/name-helper';

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
    context: ApplicationContext,
    fields: { officeId?: string },
  ): Promise<AttorneyListDbResult> {
    const assignmentsUseCase = new CaseAssignment(context);
    const attorneys = await this.gateway.getAttorneys(context, fields);

    const attorneysWithCaseLoad = [];

    for (const atty of attorneys.body.attorneyList) {
      const attorney = new Attorney(atty);
      attorney.caseLoad = await assignmentsUseCase.getCaseLoad(getFullName(attorney));
      attorneysWithCaseLoad.push(attorney.getAsObjectKeyVal());
    }

    attorneys.body.attorneyList = attorneysWithCaseLoad;
    return attorneys;
  }
}
