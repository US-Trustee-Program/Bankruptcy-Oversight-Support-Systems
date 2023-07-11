import { Context } from '../adapters/types/basic';
import { AttorneyListDbResult } from '../adapters/types/attorneys';

export interface AttorneyGatewayInterface {
  getAttorneys(
    context: Context,
    attorneyOptions: { officeId: string },
  ): Promise<AttorneyListDbResult>;
}
