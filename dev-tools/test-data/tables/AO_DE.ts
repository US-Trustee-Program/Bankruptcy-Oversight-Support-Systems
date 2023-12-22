import { ColumnNames, TableRecordHelper } from '../types';
import { toSqlInsertStatements } from '../utility';

/*
use AODATEX_SUB
go

create table dbo.AO_DE
(
    CS_CASEID       varchar(9) not null collate SQL_Latin1_General_CP1_CI_AS,
    COURT_ID        varchar(4) not null collate SQL_Latin1_General_CP1_CI_AS,
    DE_SEQNO        int        not null,
    DE_DOCUMENT_NUM int,
    DE_DATE_ENTER   datetime,
    DE_DATE_FILED   datetime,
    DE_TYPE         varchar(10) collate SQL_Latin1_General_CP1_CI_AS,
    DO_SUMMARY_TEXT varchar(255) collate SQL_Latin1_General_CP1_CI_AS,
    DO_SUB_TYPE     varchar(8) collate SQL_Latin1_General_CP1_CI_AS,
    DO_SELECT_TEXT  varchar(255) collate SQL_Latin1_General_CP1_CI_AS,
    DP_FEE          numeric(10, 2),
    DT_TEXT         varchar(max) collate SQL_Latin1_General_CP1_CI_AS,
    constraint XPKAO_DE
        primary key nonclustered (CS_CASEID, COURT_ID, DE_SEQNO),
    constraint RAO_CS_DE
        foreign key (CS_CASEID, COURT_ID) references dbo.AO_CS
)
go

create index AO_DE_IDX
    on dbo.AO_DE (CS_CASEID, COURT_ID) include (DE_SEQNO, DE_DATE_ENTER, DE_DATE_FILED)
go

create index AO_DE_IDX_DE_DATE_ENTER_082622
    on dbo.AO_DE (DE_DATE_ENTER) include (CS_CASEID, COURT_ID)
go

create index XIE1AO_DE
    on dbo.AO_DE (COURT_ID, CS_CASEID)
go

create index XIE2AO_DE
    on dbo.AO_DE (COURT_ID, DE_DATE_ENTER)
go

create index XIE3AO_DE
    on dbo.AO_DE (CS_CASEID, COURT_ID, DE_DATE_ENTER)
go
*/

export const AO_DE_TableName = 'AO_DE';
export const AO_DE_InsertableColumnNames: ColumnNames = [
  'CS_CASEID',
  'COURT_ID',
  'DE_SEQNO',
  'DE_DOCUMENT_NUM',
  'DE_DATE_ENTER',
  'DE_DATE_FILED',
  'DE_TYPE',
  'DO_SUMMARY_TEXT',
  'DO_SUB_TYPE',
  'DO_SELECT_TEXT',
  'DP_FEE',
  'DT_TEXT',
];
export const AO_DE_ColumnNames: ColumnNames = [...AO_DE_InsertableColumnNames];
export interface AO_DE_RecordProps {
  CS_CASEID: string;
  COURT_ID: string;
  DE_SEQNO: number;
  DE_DOCUMENT_NUM?: number;
  DE_DATE_ENTER?: string;
  DE_DATE_FILED?: string;
  DE_TYPE?: string;
  DO_SUMMARY_TEXT?: string;
  DO_SUB_TYPE?: string;
  DO_SELECT_TEXT?: string;
  DP_FEE?: number;
  DT_TEXT?: string;
}
export class AO_DE_Record implements TableRecordHelper {
  CS_CASEID: string = '';
  COURT_ID: string = '';
  DE_SEQNO: number = 0;
  DE_DOCUMENT_NUM?: string;
  DE_DATE_ENTER?: string;
  DE_DATE_FILED?: string;
  DE_TYPE?: string;
  DO_SUMMARY_TEXT?: string;
  DO_SUB_TYPE?: string;
  DO_SELECT_TEXT?: string;
  DP_FEE?: string;
  DT_TEXT?: string;

  constructor(props: AO_DE_RecordProps) {
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
      this.DE_SEQNO,
      this.DE_DOCUMENT_NUM,
      this.DE_DATE_ENTER,
      this.DE_DATE_FILED,
      this.DE_TYPE,
      this.DO_SUMMARY_TEXT,
      this.DO_SUB_TYPE,
      this.DO_SELECT_TEXT,
      this.DP_FEE,
      this.DT_TEXT,
    ];
  }
}
export function toAoDeInsertStatements(records: Array<AO_DE_Record>): string[] {
  return toSqlInsertStatements(AO_DE_TableName, AO_DE_InsertableColumnNames, records);
}

export const AO_DE_Types = ['misc', 'order', 'motion', 'crditcrd'];
