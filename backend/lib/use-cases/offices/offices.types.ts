import { UstpOfficeDetails } from '@common/cams/offices';
import { ApplicationContext } from '../../adapters/types/basic';

export interface OfficesGateway {
  // TODO: Rename to getUstpOfficeName??
  getOfficeName(id: string): string;
  getOffices(applicationContext: ApplicationContext): Promise<UstpOfficeDetails[]>;
}
