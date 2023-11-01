import { ColumnNames, TableRecordHelper } from '../types';
import { assert, toSqlInsertStatements } from '../utility';

/*

CREATE TABLE [dbo].[AO_PY](
	[CS_CASEID] [varchar](9) NOT NULL,
	[COURT_ID] [varchar](4) NOT NULL,
	[PY_ROLE] [varchar](2) NOT NULL,
	[PY_LAST_NAME] [varchar](200) NULL,
	[PY_MIDDLE_NAME] [varchar](25) NULL,
	[PY_FIRST_NAME] [varchar](30) NULL,
	[PY_GENERATION] [varchar](9) NULL,
	[PY_TAXID] [varchar](15) NULL,
	[PY_SSN] [varchar](11) NULL,
	[PY_ADDRESS1] [varchar](60) NULL,
	[PY_ADDRESS2] [varchar](60) NULL,
	[PY_ADDRESS3] [varchar](60) NULL,
	[PY_CITY] [varchar](30) NULL,
	[PY_STATE] [varchar](2) NULL,
	[PY_ZIP] [varchar](13) NULL,
	[PY_COUNTRY] [varchar](40) NULL,
	[PY_PHONENO] [varchar](30) NULL,
	[PY_FAX_PHONE] [varchar](20) NULL,
	[PY_E_MAIL] [varchar](60) NULL,
	[PY_PROSE] [char](1) NULL,
	[PY_END_DATE] [date] NULL,
	[SSN_EVENT] [char](1) NULL,
	[NAME_EVENT] [char](1) NULL,
	[ADDRESS_EVENT] [char](1) NULL
) ON [PRIMARY]

*/

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
  PY_LAST_NAME?: string;
  PY_MIDDLE_NAME?: string;
  PY_FIRST_NAME?: string;
  PY_GENERATION?: string;
  PY_TAXID?: string;
  PY_SSN?: string;
  PY_ADDRESS1?: string;
  PY_ADDRESS2?: string;
  PY_ADDRESS3?: string;
  PY_CITY?: string;
  PY_STATE?: string;
  PY_ZIP?: string;
  PY_COUNTRY?: string;
  PY_PHONENO?: string;
  PY_FAX_PHONE?: string;
  PY_E_MAIL?: string;
  PY_PROSE?: string;
  PY_END_DATE?: string;
  SSN_EVENT?: string;
  NAME_EVENT?: string;
  ADDRESS_EVENT?: string;
}

export class AO_PY_Record implements AO_PY_RecordProps, TableRecordHelper {
  CS_CASEID: string = '';
  COURT_ID: string = '';
  PY_ROLE: string = '';
  PY_LAST_NAME?: string;
  PY_MIDDLE_NAME?: string;
  PY_FIRST_NAME?: string;
  PY_GENERATION?: string;
  PY_TAXID?: string;
  PY_SSN?: string;
  PY_ADDRESS1?: string;
  PY_ADDRESS2?: string;
  PY_ADDRESS3?: string;
  PY_CITY?: string;
  PY_STATE?: string;
  PY_ZIP?: string;
  PY_COUNTRY?: string;
  PY_PHONENO?: string;
  PY_FAX_PHONE?: string;
  PY_E_MAIL?: string;
  PY_PROSE?: string;
  PY_END_DATE?: string;
  SSN_EVENT?: string;
  NAME_EVENT?: string;
  ADDRESS_EVENT?: string;

  constructor(props: AO_PY_RecordProps) {
    Object.assign(this, props);
  }

  validate() {
    assert(this.CS_CASEID.length <= 9);
    assert(this.COURT_ID.length <= 4);
    assert(this.PY_ROLE.length <= 2);
    assert(!!this.PY_LAST_NAME && this.PY_LAST_NAME.length > 0 && this.PY_LAST_NAME.length <= 200);
    assert(
      !this.PY_MIDDLE_NAME || (this.PY_MIDDLE_NAME.length > 0 && this.PY_MIDDLE_NAME.length <= 25),
    );
    assert(
      !this.PY_FIRST_NAME || (this.PY_FIRST_NAME.length > 0 && this.PY_FIRST_NAME.length <= 30),
    );
    assert(
      !this.PY_GENERATION || (this.PY_GENERATION.length > 0 && this.PY_GENERATION.length <= 9),
    );
    assert(!this.PY_TAXID || (this.PY_TAXID.length > 0 && this.PY_TAXID.length <= 15));
    assert(!this.PY_SSN || (this.PY_SSN.length > 0 && this.PY_SSN.length <= 11));
    assert(!this.PY_ADDRESS1 || (this.PY_ADDRESS1.length > 0 && this.PY_ADDRESS1.length <= 60));
    assert(!this.PY_ADDRESS2 || (this.PY_ADDRESS2.length > 0 && this.PY_ADDRESS2.length <= 60));
    assert(!this.PY_ADDRESS3 || (this.PY_ADDRESS3.length > 0 && this.PY_ADDRESS3.length <= 60));
    assert(!this.PY_CITY || (this.PY_CITY.length > 0 && this.PY_CITY.length <= 30));
    assert(!this.PY_STATE || (this.PY_STATE.length > 0 && this.PY_STATE.length <= 2));
    assert(!this.PY_ZIP || (this.PY_ZIP.length > 0 && this.PY_ZIP.length <= 13));
    assert(!this.PY_COUNTRY || (this.PY_COUNTRY.length > 0 && this.PY_COUNTRY.length <= 40));
    assert(!this.PY_PHONENO || (this.PY_PHONENO.length > 0 && this.PY_PHONENO.length <= 30));
    assert(!this.PY_FAX_PHONE || (this.PY_FAX_PHONE.length > 0 && this.PY_FAX_PHONE.length <= 20));
    assert(!this.PY_E_MAIL || (this.PY_E_MAIL.length > 0 && this.PY_E_MAIL.length <= 60));
    assert(!this.PY_PROSE || (this.PY_PROSE.length > 0 && this.PY_PROSE.length <= 1));
    assert(!this.PY_END_DATE || this.PY_END_DATE.length === 10);
    assert(!this.SSN_EVENT || this.SSN_EVENT.length === 1);
    assert(!this.NAME_EVENT || this.NAME_EVENT.length === 1);
    assert(!this.ADDRESS_EVENT || this.ADDRESS_EVENT.length === 1);
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
