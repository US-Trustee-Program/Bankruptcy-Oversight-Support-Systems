import { AttorneyUser } from '../../../../common/src/cams/users';
import { ApplicationContext } from '../../adapters/types/basic';

export interface AttorneyGatewayInterface {
  getAttorneys(applicationContext: ApplicationContext): Promise<Array<AttorneyUser>>;
  getAttorneysByUstpOffice(applicationContext: ApplicationContext): Promise<Array<AttorneyUser>>;
}
