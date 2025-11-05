import { UstpOfficeDetails } from '../../../../common/src/cams/offices';
import { ApplicationContext } from '../application.types';

export interface OfficesGateway {
  // TODO: Rename to getUstpOfficeName??
  getOfficeName(id: string): string;
  getOffices(applicationContext: ApplicationContext): Promise<UstpOfficeDetails[]>;
}
