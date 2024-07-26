import { OfficeDetails } from '../../../../../common/src/cams/courts';
import { ApplicationContext } from '../../adapters/types/basic';

export interface OfficesGatewayInterface {
  getOfficeName(id: string): string;
  getOfficeByCourtIdAndOfficeCode(
    applicationContext: ApplicationContext,
    courtId: string,
    officeCode: string,
  ): Promise<OfficeDetails>;
  getOffices(applicationContext: ApplicationContext): Promise<OfficeDetails[]>;
}
