import { ColumnNames, TableRecordHelper } from '../types';
import { toSqlInsertStatements } from '../utility';

/*

use AODATEX_SUB
go

create table dbo.AO_AT
(
    CS_CASEID      varchar(9) not null collate SQL_Latin1_General_CP1_CI_AS,
    COURT_ID       varchar(4) not null collate SQL_Latin1_General_CP1_CI_AS,
    PY_ROLE        varchar(2) not null collate SQL_Latin1_General_CP1_CI_AS,
    AT_LAST_NAME   varchar(200) collate SQL_Latin1_General_CP1_CI_AS,
    AT_MIDDLE_NAME varchar(25) collate SQL_Latin1_General_CP1_CI_AS,
    AT_FIRST_NAME  varchar(30) collate SQL_Latin1_General_CP1_CI_AS,
    AT_GENERATION  varchar(9) collate SQL_Latin1_General_CP1_CI_AS,
    PR_TAXID       varchar(15) collate SQL_Latin1_General_CP1_CI_AS,
    PR_SSN         varchar(11) collate SQL_Latin1_General_CP1_CI_AS,
    AT_OFFICE      varchar(80) collate SQL_Latin1_General_CP1_CI_AS,
    AT_ADDRESS1    varchar(60) collate SQL_Latin1_General_CP1_CI_AS,
    AT_ADDRESS2    varchar(60) collate SQL_Latin1_General_CP1_CI_AS,
    AT_ADDRESS3    varchar(60) collate SQL_Latin1_General_CP1_CI_AS,
    AT_CITY        varchar(30) collate SQL_Latin1_General_CP1_CI_AS,
    AT_STATE       varchar(2) collate SQL_Latin1_General_CP1_CI_AS
        constraint RAO_STATE_AT
            references dbo.AO_STATE,
    AT_ZIP         varchar(13) collate SQL_Latin1_General_CP1_CI_AS,
    AT_COUNTRY     varchar(40) collate SQL_Latin1_General_CP1_CI_AS,
    AT_PHONENO     varchar(30) collate SQL_Latin1_General_CP1_CI_AS,
    AT_FAX_PHONE   varchar(30) collate SQL_Latin1_General_CP1_CI_AS,
    AT_E_MAIL      varchar(60) collate SQL_Latin1_General_CP1_CI_AS,
    AT_END_DATE    date,
    NAME_EVENT     char collate SQL_Latin1_General_CP1_CI_AS,
    constraint XPKAO_AT
        primary key nonclustered (CS_CASEID, COURT_ID, PY_ROLE),
    constraint RAO_PY_AT
        foreign key (CS_CASEID, COURT_ID, PY_ROLE) references dbo.AO_PY
)
go

create index XIE1AO_AT
    on dbo.AO_AT (COURT_ID, CS_CASEID)
go

*/

export const AO_AT_TableName = 'AO_AT';
export const AO_AT_InsertableColumnNames: ColumnNames = [
  'CS_CASEID',
  'COURT_ID',
  'PY_ROLE',
  'AT_LAST_NAME',
  'AT_MIDDLE_NAME',
  'AT_FIRST_NAME',
  'AT_GENERATION',
  'PR_TAXID',
  'PR_SSN',
  'AT_OFFICE',
  'AT_ADDRESS1',
  'AT_ADDRESS2',
  'AT_ADDRESS3',
  'AT_CITY',
  'AT_STATE',
  'AT_ZIP',
  'AT_COUNTRY',
  'AT_PHONENO',
  'AT_FAX_PHONE',
  'AT_E_MAIL',
  'AT_END_DATE',
  'NAME_EVENT',
];
export const AO_AT_ColumnNames: ColumnNames = [...AO_AT_InsertableColumnNames];
export interface AO_AT_RecordProps {
  CS_CASEID: string;
  COURT_ID: string;
  PY_ROLE: string;
  AT_LAST_NAME?: string;
  AT_MIDDLE_NAME?: string;
  AT_FIRST_NAME?: string;
  AT_GENERATION?: string;
  PR_TAXID?: string;
  PR_SSN?: string;
  AT_OFFICE?: string;
  AT_ADDRESS1?: string;
  AT_ADDRESS2?: string;
  AT_ADDRESS3?: string;
  AT_CITY?: string;
  AT_STATE?: string;
  AT_ZIP?: string;
  AT_COUNTRY?: string;
  AT_PHONENO?: string;
  AT_FAX_PHONE?: string;
  AT_E_MAIL?: string;
  AT_END_DATE?: string;
  NAME_EVENT?: string;
}
export class AO_AT_Record implements TableRecordHelper {
  CS_CASEID: string = '';
  COURT_ID: string = '';
  PY_ROLE: string = '';
  AT_LAST_NAME?: string;
  AT_MIDDLE_NAME?: string;
  AT_FIRST_NAME?: string;
  AT_GENERATION?: string;
  PR_TAXID?: string;
  PR_SSN?: string;
  AT_OFFICE?: string;
  AT_ADDRESS1?: string;
  AT_ADDRESS2?: string;
  AT_ADDRESS3?: string;
  AT_CITY?: string;
  AT_STATE?: string;
  AT_ZIP?: string;
  AT_COUNTRY?: string;
  AT_PHONENO?: string;
  AT_FAX_PHONE?: string;
  AT_E_MAIL?: string;
  AT_END_DATE?: string;
  NAME_EVENT?: string;

  constructor(props: AO_AT_RecordProps) {
    Object.assign(this, props);
  }
  validate(): void {
    /// TODO: implement this schema validation
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toInsertableArray(): any[] {
    return [
      this.CS_CASEID,
      this.COURT_ID,
      this.PY_ROLE,
      this.AT_LAST_NAME,
      this.AT_MIDDLE_NAME,
      this.AT_FIRST_NAME,
      this.AT_GENERATION,
      this.PR_TAXID,
      this.PR_SSN,
      this.AT_OFFICE,
      this.AT_ADDRESS1,
      this.AT_ADDRESS2,
      this.AT_ADDRESS3,
      this.AT_CITY,
      this.AT_STATE,
      this.AT_ZIP,
      this.AT_COUNTRY,
      this.AT_PHONENO,
      this.AT_FAX_PHONE,
      this.AT_E_MAIL,
      this.AT_END_DATE,
      this.NAME_EVENT,
    ];
  }
}
export function toAoAtInsertStatements(records: Array<AO_AT_Record>): string[] {
  return toSqlInsertStatements(AO_AT_TableName, AO_AT_InsertableColumnNames, records);
}
