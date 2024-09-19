import { Auditable } from './auditable';
import { CamsUserReference } from './users';

export type OfficeStaff = Auditable &
  CamsUserReference & {
    documentType: 'OFFICE_STAFF';
    officeCode: string;
  };
