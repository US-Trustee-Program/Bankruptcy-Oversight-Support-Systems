import { ApplicationContext } from '../../adapters/types/basic';
import { OfficeDetails } from './offices.model';
import { getOfficesGateway } from '../../factory';

export class OfficesUseCase {
  public async getOffices(applicationContext: ApplicationContext): Promise<Array<OfficeDetails>> {
    const gateway = getOfficesGateway(applicationContext);
    return gateway.getOffices(applicationContext);
  }
}
