import { OfficeDetails } from '../../../../../common/src/cams/courts';
import { ApplicationContext } from '../../adapters/types/basic';
import { getOfficesGateway, getOfficesRepository } from '../../factory';
import { AttorneyUser } from '../../../../../common/src/cams/users';

export class OfficesUseCase {
  public async getOffices(context: ApplicationContext): Promise<OfficeDetails[]> {
    const gateway = getOfficesGateway(context);
    return gateway.getOffices(context);
  }

  public async getOfficeAttorneys(
    context: ApplicationContext,
    officeCode: string,
  ): Promise<AttorneyUser[]> {
    const repository = getOfficesRepository(context);
    return repository.getOfficeAttorneys(context, officeCode);
  }
}
