import { ApplicationContext } from '../adapters/types/basic';
import { AttorneyListDbResult } from '../adapters/types/attorneys';

export interface AttorneyGatewayInterface {
  getAttorneys(
    context: ApplicationContext,
    attorneyOptions: { officeId?: string },
  ): Promise<AttorneyListDbResult>;
}
