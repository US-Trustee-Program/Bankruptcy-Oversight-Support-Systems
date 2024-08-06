import { OfficeDetails } from './courts';
import { CamsRole } from './roles';

export type CamsUserReference = {
  id: string;
  name: string;
};

export type CamsUser = CamsUserReference & {
  offices?: OfficeDetails[];
  roles?: CamsRole[];
};

export type AttorneyUser = CamsUser & {
  caseLoad?: number;
};
