import { ApplicationContext } from '../../adapters/types/basic';
import { OfficeDetails } from './offices.model';

export interface OfficesGatewayInterface {
  getOffice(id: string): string;
  getOffices(applicationContext: ApplicationContext): Promise<OfficeDetails[]>;
}
