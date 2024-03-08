import { OfficeDetails } from '../../../../../common/src/cams/courts';
import { ApplicationContext } from '../../adapters/types/basic';

export interface OfficesGatewayInterface {
  getOffice(id: string): string;
  getOffices(applicationContext: ApplicationContext): Promise<OfficeDetails[]>;
}
