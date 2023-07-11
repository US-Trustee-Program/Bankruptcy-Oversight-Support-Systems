import { AttorneyGatewayInterface } from './attorney.gateway.interface';
import { AttorneyListDbResult } from '../adapters/types/attorneys';
import { Context } from '../adapters/types/basic';
import { getAttorneyGateway } from '../factory';

namespace UseCases {
  export class AttorneysList {
    gateway: AttorneyGatewayInterface;

    constructor(gateway?: AttorneyGatewayInterface) {
      if (!gateway) {
        this.gateway = getAttorneyGateway();
      } else {
        this.gateway = gateway;
      }
    }

    async getAttorneyList(
      context: Context,
      fields: { officeId: string },
    ): Promise<AttorneyListDbResult> {
      return await this.gateway.getAttorneys(context, fields);
    }
  }
}

export default UseCases.AttorneysList;
