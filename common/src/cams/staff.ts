import { Auditable } from './auditable';
import { CamsUserReference } from './users';

export type OfficeStaff = CamsUserReference &
  Auditable & {
    id: string;
    documentType: 'OFFICE_STAFF';
    officeCode: string;
  };
