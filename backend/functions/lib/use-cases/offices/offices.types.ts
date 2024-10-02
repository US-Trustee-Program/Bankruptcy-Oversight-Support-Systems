import { CamsUserReference } from '../../../../../common/src/cams/users';
import { ApplicationContext } from '../../adapters/types/basic';

export type FlatOfficeDetails = {
  officeName: string;
  officeCode: string;
  courtId: string;
  courtName: string;
  courtDivisionCode: string;
  courtDivisionName: string;
  groupDesignator: string;
  regionId: string;
  regionName: string;
  state?: string;
  staff?: CamsUserReference[];
};

export interface OfficesGateway {
  getOfficeName(id: string): string;

  getOfficesByGroupDesignator(
    applicationContext: ApplicationContext,
    groupDesignator: string,
  ): Promise<FlatOfficeDetails[]>;

  getOffices(applicationContext: ApplicationContext): Promise<FlatOfficeDetails[]>;
}
