import { Chapter, ColumnNames, DebtorType, TableRecordHelper, TxCode, TxType } from '../types';
import { assert, toSqlInsertStatements } from '../utility';

/*
use AODATEX_SUB
go

create table dbo.AO_TX
(
    CS_CASEID  varchar(9)   not null collate SQL_Latin1_General_CP1_CI_AS,
    COURT_ID   varchar(4)   not null collate SQL_Latin1_General_CP1_CI_AS,
    DE_SEQNO   int          not null,
    CASE_ID    varchar(10)  not null collate SQL_Latin1_General_CP1_CI_AS,
    JOB_ID     int          not null,
    TX_TYPE    char         not null collate SQL_Latin1_General_CP1_CI_AS,
    TX_CODE    varchar(3)   not null collate SQL_Latin1_General_CP1_CI_AS,
    TX_DATE    datetime2    not null,
    REC        varchar(237) not null collate SQL_Latin1_General_CP1_CI_AS,
    AO_TX_DISP varchar(2) collate SQL_Latin1_General_CP1_CI_AS,
    TX_DISP    varchar(2) collate SQL_Latin1_General_CP1_CI_AS
        constraint R_155
            references dbo.AO_TX_DISP,
    TX_ID      bigint identity
        constraint XPKAO_TX
            primary key nonclustered,
    constraint RAO_TX_CODE_TX
        foreign key (TX_TYPE, TX_CODE) references dbo.AO_TX_CODE
)
go

create index AO_TX_IDX
    on dbo.AO_TX (TX_TYPE, TX_CODE, TX_DATE) include (CS_CASEID, COURT_ID)
go

create index XIE1AO_TX
    on dbo.AO_TX (CASE_ID)
go

create index XIE2AO_TX
    on dbo.AO_TX (COURT_ID, CS_CASEID)
go

create index XIE3AO_TX
    on dbo.AO_TX (JOB_ID)
go

create index XIE4AO_TX
    on dbo.AO_TX (TX_CODE, TX_TYPE, DE_SEQNO, CS_CASEID, COURT_ID)
go

create index XIF1AO_TX
    on dbo.AO_TX (TX_TYPE, TX_CODE)
go

create index XIF2AO_TX
    on dbo.AO_TX (CS_CASEID, COURT_ID, DE_SEQNO)
go
*/

export const AO_TX_TableName = 'AO_TX';
export const AO_TX_InsertableColumnNames: ColumnNames = [
  'CS_CASEID',
  'COURT_ID',
  'DE_SEQNO',
  'CASE_ID',
  'JOB_ID',
  'TX_TYPE',
  'TX_CODE',
  'TX_DATE',
  'REC',
  'AO_TX_DISP',
  'TX_DISP',
];

export const AO_TX_ColumnNames = [...AO_TX_InsertableColumnNames, 'TX_ID'];

export function buildRec(
  type: string,
  div: string,
  year: string,
  caseId: string,
  code: string,
  date: string,
  chapter: string,
  meta = 'Court specific metadata',
): string {
  // O000000811886875CBC22123115000000        [15]221231 Case Closed
  // O 00000 081 18 86875 CBC 221231 15 000000        [ 15 ] 221231 Case Closed
  const metaPaddedLength = 74;
  const pad = ' '.repeat(metaPaddedLength);
  const paddedMeta = (meta + pad).slice(0, metaPaddedLength - 1);
  const comp = date.split('-');
  const formatedDate = comp[0].slice(2) + comp[1] + comp[2];
  return `${type}00000${div}${year}${caseId}${code}${formatedDate}${chapter}000000        [${chapter}] ${formatedDate} ${paddedMeta}`;
}

export function buildRecType1(chapter: Chapter, debtorType: DebtorType): string {
  // template: 'NNNNNNNNNNNNN-NNNNN            NNAANN-NNNNNNN     NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNAANNNNNN                                 NNNNN';
  return [
    'NNNNNNNNNNNNN-NNNNN            ',
    chapter,
    debtorType,
    'NN-NNNNNNN     NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNAANNNNNN                                 NNNNN',
  ].join('');
}

export function buildRecFromTxRecord(
  rec: AO_TX_Record,
  div: string,
  chapter: Chapter,
  meta: string,
): string {
  const caseIdParts = rec.CASE_ID.split('-');
  switch (rec.TX_TYPE) {
    case 'O':
      return buildRec(
        rec.TX_TYPE,
        div,
        caseIdParts[0],
        caseIdParts[1],
        rec.TX_CODE,
        rec.TX_DATE,
        chapter,
        meta,
      );
    default:
      return '';
  }
}

export interface AO_TX_RecordProps {
  CS_CASEID: string;
  COURT_ID: string;
  DE_SEQNO: number;
  CASE_ID: string;
  JOB_ID: number;
  TX_TYPE: TxType;
  TX_CODE: TxCode;
  TX_DATE: string;
  REC?: string;
  AO_TX_DISP?: string;
  TX_DISP?: string;
}

export class AO_TX_Record implements TableRecordHelper {
  // Columns in schema order
  CS_CASEID: string = '';
  COURT_ID: string = '';
  DE_SEQNO: number = -1;
  CASE_ID: string = '';
  JOB_ID: number = -1;
  TX_TYPE: TxType = 'O';
  TX_CODE: TxCode = 'CBC';
  TX_DATE: string = '';
  REC?: string;
  AO_TX_DISP?: string;
  TX_DISP?: string;

  // Ignore TX_ID. It is an autogenerated key. Let the DB autogenerate.
  // TX_ID: number;      // bigint identity

  constructor(props: AO_TX_RecordProps) {
    Object.assign(this, props);
  }

  validate() {
    assert(this.CS_CASEID.length <= 9);
    assert(this.COURT_ID.length <= 4);
    assert(this.CASE_ID.length <= 10);
    assert(this.TX_TYPE.length === 1);
    assert(this.TX_CODE.length <= 3);
    assert(this.TX_DATE.length == 10);
    assert(this.REC !== undefined && this.REC.length > 0 && this.REC.length <= 237);
    assert(!this.AO_TX_DISP || this.AO_TX_DISP.length <= 2);
    assert(!this.TX_DISP || this.TX_DISP.length <= 2);
  }

  toInsertableArray(): Array<string | number | null | undefined> {
    return [
      this.CS_CASEID,
      this.COURT_ID,
      this.DE_SEQNO,
      this.CASE_ID,
      this.JOB_ID,
      this.TX_TYPE,
      this.TX_CODE,
      this.TX_DATE,
      this.REC,
      this.AO_TX_DISP,
      this.TX_DISP,
    ];
  }
}

export function toAoTxInsertStatements(records: Array<AO_TX_Record>): string[] {
  return toSqlInsertStatements(AO_TX_TableName, AO_TX_InsertableColumnNames, records);
}
