import { ApplicationContext } from '../adapters/types/basic';
import { AttorneyUser } from '../../../../common/src/cams/users';

export interface AttorneyGatewayInterface {
  getAttorneys(applicationContext: ApplicationContext): Promise<Array<AttorneyUser>>;
  getAttorneysByUstpOffice(applicationContext: ApplicationContext): Promise<Array<AttorneyUser>>;
}
