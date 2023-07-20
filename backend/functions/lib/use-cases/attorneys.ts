import { AttorneyGatewayInterface } from './attorney.gateway.interface';
import { AttorneyListDbResult } from '../adapters/types/attorneys';
import { ApplicationContext } from '../adapters/types/basic';
import { getAttorneyGateway } from '../factory';

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
    return await this.gateway.getAttorneys(context, fields);
  }
}
