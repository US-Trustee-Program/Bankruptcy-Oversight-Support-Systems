import { Auditable } from './auditable';
import { CamsUserReference } from './users';

export type OfficeStaff = CamsUserReference &
  Auditable & {
    documentType: 'OFFICE_STAFF';
    officeCode: string;
  };
