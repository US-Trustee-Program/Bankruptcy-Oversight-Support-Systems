import { OfficeDetails } from '../../../../../common/src/cams/courts';
import { ApplicationContext } from '../../adapters/types/basic';

export interface OfficesGatewayInterface {
  getOfficeName(id: string): string;

  getOfficesByGroupDesignator(
    applicationContext: ApplicationContext,
    groupDesignator: string,
  ): Promise<OfficeDetails[]>;

  getOffices(applicationContext: ApplicationContext): Promise<OfficeDetails[]>;
}
