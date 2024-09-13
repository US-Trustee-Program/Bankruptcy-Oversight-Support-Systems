import { OfficeDetails } from './courts';
import { CamsRole } from './roles';

export type CamsUserReference = {
  id: string;
  name: string;
  roles?: CamsRole[];
};

export type CamsUser = CamsUserReference & {
  offices?: OfficeDetails[];
};

export type AttorneyUser = CamsUser & {
  caseLoad?: number;
};

export type CamsUserGroup = {
  id: string;
  name: string;
  users?: CamsUser[];
};
