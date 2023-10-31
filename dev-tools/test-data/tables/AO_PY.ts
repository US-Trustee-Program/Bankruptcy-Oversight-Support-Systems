import { ColumnNames, TableRecordHelper } from '../types';
import { toSqlInsertStatements } from '../utility';

export const AO_PY_TableName = 'AO_PY';
export const AO_PY_InsertableColumnNames: ColumnNames = [
  'CS_CASEID',
  'COURT_ID',
  'PY_ROLE',
  'PY_LAST_NAME',
  'PY_MIDDLE_NAME',
  'PY_FIRST_NAME',
  'PY_GENERATION',
  'PY_TAXID',
  'PY_SSN',
  'PY_ADDRESS1',
  'PY_ADDRESS2',
  'PY_ADDRESS3',
  'PY_CITY',
  'PY_STATE',
  'PY_ZIP',
  'PY_COUNTRY',
  'PY_PHONENO',
  'PY_FAX_PHONE',
  'PY_E_MAIL',
  'PY_PROSE',
  'PY_END_DATE',
  'SSN_EVENT',
  'NAME_EVENT',
  'ADDRESS_EVENT',
];

export const AO_PY_ColumnNames: ColumnNames = [...AO_PY_InsertableColumnNames];

export interface AO_PY_RecordProps {
  CS_CASEID: string;
  COURT_ID: string;
  PY_ROLE: string;
  PY_LAST_NAME: string;
  PY_MIDDLE_NAME: string;
  PY_FIRST_NAME: string;
  PY_GENERATION: string;
  PY_TAXID: string;
  PY_SSN: string;
  PY_ADDRESS1: string;
  PY_ADDRESS2: string;
  PY_ADDRESS3: string;
  PY_CITY: string;
  PY_STATE: string;
  PY_ZIP: string;
  PY_COUNTRY: string;
  PY_PHONENO: string;
  PY_FAX_PHONE: string;
  PY_E_MAIL: string;
  PY_PROSE: string;
  PY_END_DATE: string;
  SSN_EVENT: string;
  NAME_EVENT: string;
  ADDRESS_EVENT: string;
}

export class AO_PY_Record implements AO_PY_RecordProps, TableRecordHelper {
  CS_CASEID: string = '';
  COURT_ID: string = '';
  PY_ROLE: string = '';
  PY_LAST_NAME: string = '';
  PY_MIDDLE_NAME: string = '';
  PY_FIRST_NAME: string = '';
  PY_GENERATION: string = '';
  PY_TAXID: string = '';
  PY_SSN: string = '';
  PY_ADDRESS1: string = '';
  PY_ADDRESS2: string = '';
  PY_ADDRESS3: string = '';
  PY_CITY: string = '';
  PY_STATE: string = '';
  PY_ZIP: string = '';
  PY_COUNTRY: string = '';
  PY_PHONENO: string = '';
  PY_FAX_PHONE: string = '';
  PY_E_MAIL: string = '';
  PY_PROSE: string = '';
  PY_END_DATE: string = '';
  SSN_EVENT: string = '';
  NAME_EVENT: string = '';
  ADDRESS_EVENT: string = '';

  constructor(props: AO_PY_RecordProps) {
    Object.assign(this, props);
  }

  validate() {
    // TODO: Implement this schema validation.
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toInsertableArray(): any[] {
    return [
      this.CS_CASEID,
      this.COURT_ID,
      this.PY_ROLE,
      this.PY_LAST_NAME,
      this.PY_MIDDLE_NAME,
      this.PY_FIRST_NAME,
      this.PY_GENERATION,
      this.PY_TAXID,
      this.PY_SSN,
      this.PY_ADDRESS1,
      this.PY_ADDRESS2,
      this.PY_ADDRESS3,
      this.PY_CITY,
      this.PY_STATE,
      this.PY_ZIP,
      this.PY_COUNTRY,
      this.PY_PHONENO,
      this.PY_FAX_PHONE,
      this.PY_E_MAIL,
      this.PY_PROSE,
      this.PY_END_DATE,
      this.SSN_EVENT,
      this.NAME_EVENT,
      this.ADDRESS_EVENT,
    ];
  }
}

export function toAoPyInsertStatements(records: Array<AO_PY_Record>): string[] {
  return toSqlInsertStatements(AO_PY_TableName, AO_PY_InsertableColumnNames, records);
}
