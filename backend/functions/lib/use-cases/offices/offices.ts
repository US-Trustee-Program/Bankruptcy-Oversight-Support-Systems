import { getOffices } from '../../adapters/gateways/offices.gateway';
import { ApplicationContext } from '../../adapters/types/basic';
import { OfficeDetails } from './offices.model';

export class OfficesUseCase {
  public async getOffices(applicationContext: ApplicationContext): Promise<Array<OfficeDetails>> {
    return getOffices(applicationContext);
  }
}
