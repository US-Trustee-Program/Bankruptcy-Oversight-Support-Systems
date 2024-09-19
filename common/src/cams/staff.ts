import { Auditable } from './auditable';
import { CamsUserReference } from './users';

export type OfficeStaff = Auditable & {
  id: string;
  documentType: 'OFFICE_STAFF';
  officeCode: string;
  user: CamsUserReference;
};
