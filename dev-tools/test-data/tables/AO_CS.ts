import { ColumnNames, TableRecordHelper } from '../types';
import { toSqlInsertStatements } from '../utility';

/*
use AODATEX_SUB
go

create table dbo.AO_CS
(
    CS_CASEID                     varchar(9) not null collate SQL_Latin1_General_CP1_CI_AS,
    COURT_ID                      varchar(4) not null collate SQL_Latin1_General_CP1_CI_AS
        constraint RAO_COURT_CS
            references dbo.AO_COURT,
    CS_CASE_NUMBER                varchar(20) collate SQL_Latin1_General_CP1_CI_AS,
    CS_DIV                        varchar(3) not null collate SQL_Latin1_General_CP1_CI_AS,
    GRP_DES                       varchar(2) not null collate SQL_Latin1_General_CP1_CI_AS,
    CASE_ID                       varchar(10) collate SQL_Latin1_General_CP1_CI_AS,
    CS_SHORT_TITLE                varchar(150) collate SQL_Latin1_General_CP1_CI_AS,
    CS_CLOSED                     char collate SQL_Latin1_General_CP1_CI_AS,
    CS_CHAPTER                    varchar(3) collate SQL_Latin1_General_CP1_CI_AS
        constraint RAO_CHAPTER_CS
            references dbo.AO_CHAPTER,
    CS_JOINT                      char collate SQL_Latin1_General_CP1_CI_AS,
    CS_TYPE                       varchar(2) collate SQL_Latin1_General_CP1_CI_AS,
    CS_FEE_STATUS                 varchar(2) collate SQL_Latin1_General_CP1_CI_AS,
    CS_PREV_CHAPTER               varchar(3) collate SQL_Latin1_General_CP1_CI_AS
        constraint RAO_CHAPTER_CS_PRE
            references dbo.AO_CHAPTER,
    CS_VOL_INVOL                  char collate SQL_Latin1_General_CP1_CI_AS,
    CS_DATE_FILED                 date,
    CS_DATE_CONVERT               date,
    CS_REOPEN_CODE                char collate SQL_Latin1_General_CP1_CI_AS,
    CS_DATE_REOPEN                date,
    CS_DATE_TERM                  date,
    CS_DATE_DISCHARGE             date,
    CS_DATE_DISMISS               date,
    BK_ASSET_NOTICE               varchar(3) collate SQL_Latin1_General_CP1_CI_AS,
    CS_COUNTY                     varchar(40) collate SQL_Latin1_General_CP1_CI_AS,
    CF_VALUE                      varchar(400) collate SQL_Latin1_General_CP1_CI_AS,
    CS_DISP_METHOD                varchar(100) collate SQL_Latin1_General_CP1_CI_AS,
    JD_LAST_NAME                  varchar(40) collate SQL_Latin1_General_CP1_CI_AS,
    JD_MIDDLE_NAME                varchar(25) collate SQL_Latin1_General_CP1_CI_AS,
    JD_FIRST_NAME                 varchar(30) collate SQL_Latin1_General_CP1_CI_AS,
    LAST_DATE_ENTER               date,
    JD_EVENT                      char collate SQL_Latin1_General_CP1_CI_AS,
    CASE_NUMBER_EVENT             char collate SQL_Latin1_General_CP1_CI_AS,
    DATE_FILED_EVENT              char collate SQL_Latin1_General_CP1_CI_AS,
    CS_DISP_JT_METHOD             varchar(100) collate SQL_Latin1_General_CP1_CI_AS,
    BK_NATURE_business_event      char collate SQL_Latin1_General_CP1_CI_AS,
    BK_SMALL_BUS_EVENT            char collate SQL_Latin1_General_CP1_CI_AS,
    BK_AGR_LIQ_DEBT_TWO_MIL_EVENT char collate SQL_Latin1_General_CP1_CI_AS,
    BK_PREPACKAGED_EVENT          char collate SQL_Latin1_General_CP1_CI_AS,
    BK_PRIOR_FILING_EVENT         char collate SQL_Latin1_General_CP1_CI_AS,
    PP_EVENT                      varchar collate SQL_Latin1_General_CP1_CI_AS,
    sfi_event                     varchar collate SQL_Latin1_General_CP1_CI_AS,
    sfc_event                     varchar collate SQL_Latin1_General_CP1_CI_AS,
    ST6_event                     varchar collate SQL_Latin1_General_CP1_CI_AS,
    ST6_WD_event                  varchar collate SQL_Latin1_General_CP1_CI_AS,
    cs_subchapter                 varchar collate SQL_Latin1_General_CP1_CI_AS,
    cs_subchapter_event           varchar collate SQL_Latin1_General_CP1_CI_AS,
    SPV_event                     varchar collate SQL_Latin1_General_CP1_CI_AS,
    SPN_event                     varchar collate SQL_Latin1_General_CP1_CI_AS,
    constraint XPKAO_CS
        primary key nonclustered (CS_CASEID, COURT_ID),
    constraint RAO_CS_DIV_CS
        foreign key (CS_DIV, GRP_DES) references dbo.AO_CS_DIV
)
go

*/

export const AO_CS_TableName = 'AO_CS';
export const AO_CS_InsertableColumnNames: ColumnNames = [
  'CS_CASEID',
  'COURT_ID',
  'CS_CASE_NUMBER',
  'CS_DIV',
  'GRP_DES',
  'CASE_ID',
  'CS_SHORT_TITLE',
  'CS_CLOSED',
  'CS_CHAPTER',
  'CS_JOINT',
  'CS_TYPE',
  'CS_FEE_STATUS',
  'CS_PREV_CHAPTER',
  'CS_VOL_INVOL',
  'CS_DATE_FILED',
  'CS_DATE_CONVERT',
  'CS_REOPEN_CODE',
  'CS_DATE_REOPEN',
  'CS_DATE_TERM',
  'CS_DATE_DISCHARGE',
  'CS_DATE_DISMISS',
  'BK_ASSET_NOTICE',
  'CS_COUNTY',
  'CF_VALUE',
  'CS_DISP_METHOD',
  'JD_LAST_NAME',
  'JD_MIDDLE_NAME',
  'JD_FIRST_NAME',
  'LAST_DATE_ENTER',
  'JD_EVENT',
  'CASE_NUMBER_EVENT',
  'DATE_FILED_EVENT',
  'CS_DISP_JT_METHOD',
  'BK_NATURE_business_event',
  'BK_SMALL_BUS_EVENT',
  'BK_AGR_LIQ_DEBT_TWO_MIL_EVENT',
  'BK_PREPACKAGED_EVENT',
  'BK_PRIOR_FILING_EVENT',
  'PP_EVENT',
  'sfi_event',
  'sfc_event',
  'ST6_event',
  'ST6_WD_event',
  'cs_subchapter',
  'cs_subchapter_event',
  'SPV_event',
  'SPN_event',
];
export const AO_CS_ColumnNames: ColumnNames = [...AO_CS_InsertableColumnNames];

export interface AO_CS_RecordProps {
  CS_CASEID: string;
  COURT_ID: string;
  CS_CASE_NUMBER: string;
  CS_DIV: string;
  GRP_DES: string;
  CASE_ID: string;
  CS_SHORT_TITLE: string;
  CS_CLOSED?: string;
  CS_CHAPTER: string;
  CS_JOINT: string;
  CS_TYPE: string;
  CS_FEE_STATUS: string;
  CS_PREV_CHAPTER?: string;
  CS_VOL_INVOL: string;
  CS_DATE_FILED: string;
  CS_DATE_CONVERT?: string;
  CS_REOPEN_CODE: string;
  CS_DATE_REOPEN?: string;
  CS_DATE_TERM?: string;
  CS_DATE_DISCHARGE?: string;
  CS_DATE_DISMISS?: string;
  BK_ASSET_NOTICE?: string;
  CS_COUNTY: string;
  CF_VALUE?: string;
  CS_DISP_METHOD: string;
  JD_LAST_NAME?: string;
  JD_MIDDLE_NAME?: string;
  JD_FIRST_NAME?: string;
  LAST_DATE_ENTER?: string;
  JD_EVENT?: string;
  CASE_NUMBER_EVENT?: string;
  DATE_FILED_EVENT?: string;
  CS_DISP_JT_METHOD?: string;
  BK_NATURE_business_event?: string;
  BK_SMALL_BUS_EVENT?: string;
  BK_AGR_LIQ_DEBT_TWO_MIL_EVENT?: string;
  BK_PREPACKAGED_EVENT?: string;
  BK_PRIOR_FILING_EVENT?: string;
  PP_EVENT?: string;
  sfi_event?: string;
  sfc_event?: string;
  ST6_event?: string;
  ST6_WD_event?: string;
  cs_subchapter?: string;
  cs_subchapter_event?: string;
  SPV_event?: string;
  SPN_event?: string;
}

export class AO_CS_Record implements TableRecordHelper {
  CS_CASEID: string = '';
  COURT_ID: string = '';
  CS_CASE_NUMBER: string = '';
  CS_DIV: string = '';
  GRP_DES: string = '';
  CASE_ID: string = '';
  CS_SHORT_TITLE: string = '';
  CS_CLOSED?: string;
  CS_CHAPTER: string = '';
  CS_JOINT: string = '';
  CS_TYPE: string = 'bk';
  CS_FEE_STATUS: string = '';
  CS_PREV_CHAPTER?: string;
  CS_VOL_INVOL: string = '';
  CS_DATE_FILED: string = '';
  CS_DATE_CONVERT?: string;
  CS_REOPEN_CODE: string = '';
  CS_DATE_REOPEN?: string;
  CS_DATE_TERM?: string;
  CS_DATE_DISCHARGE?: string;
  CS_DATE_DISMISS?: string;
  BK_ASSET_NOTICE?: string;
  CS_COUNTY: string = '';
  CF_VALUE?: string = '';
  CS_DISP_METHOD: string = '';
  JD_LAST_NAME?: string;
  JD_MIDDLE_NAME?: string;
  JD_FIRST_NAME?: string;
  LAST_DATE_ENTER?: string;
  JD_EVENT?: string;
  CASE_NUMBER_EVENT?: string;
  DATE_FILED_EVENT?: string;
  CS_DISP_JT_METHOD?: string;
  BK_NATURE_business_event?: string;
  BK_SMALL_BUS_EVENT?: string;
  BK_AGR_LIQ_DEBT_TWO_MIL_EVENT?: string;
  BK_PREPACKAGED_EVENT?: string;
  BK_PRIOR_FILING_EVENT?: string;
  PP_EVENT?: string;
  sfi_event?: string;
  sfc_event?: string;
  ST6_event?: string;
  ST6_WD_event?: string;
  cs_subchapter?: string;
  cs_subchapter_event?: string;
  SPV_event?: string;
  SPN_event?: string;

  constructor(props: AO_CS_RecordProps) {
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
      this.CS_CASE_NUMBER,
      this.CS_DIV,
      this.GRP_DES,
      this.CASE_ID,
      this.CS_SHORT_TITLE,
      this.CS_CLOSED,
      this.CS_CHAPTER,
      this.CS_JOINT,
      this.CS_TYPE,
      this.CS_FEE_STATUS,
      this.CS_PREV_CHAPTER,
      this.CS_VOL_INVOL,
      this.CS_DATE_FILED,
      this.CS_DATE_CONVERT,
      this.CS_REOPEN_CODE,
      this.CS_DATE_REOPEN,
      this.CS_DATE_TERM,
      this.CS_DATE_DISCHARGE,
      this.CS_DATE_DISMISS,
      this.BK_ASSET_NOTICE,
      this.CS_COUNTY,
      this.CF_VALUE,
      this.CS_DISP_METHOD,
      this.JD_LAST_NAME,
      this.JD_MIDDLE_NAME,
      this.JD_FIRST_NAME,
      this.LAST_DATE_ENTER,
      this.JD_EVENT,
      this.CASE_NUMBER_EVENT,
      this.DATE_FILED_EVENT,
      this.CS_DISP_JT_METHOD,
      this.BK_NATURE_business_event,
      this.BK_SMALL_BUS_EVENT,
      this.BK_AGR_LIQ_DEBT_TWO_MIL_EVENT,
      this.BK_PREPACKAGED_EVENT,
      this.BK_PRIOR_FILING_EVENT,
      this.PP_EVENT,
      this.sfi_event,
      this.sfc_event,
      this.ST6_event,
      this.ST6_WD_event,
      this.cs_subchapter,
      this.cs_subchapter_event,
      this.SPV_event,
      this.SPN_event,
    ];
  }
}

export function toAoCsInsertStatements(records: Array<AO_CS_Record>): string[] {
  return toSqlInsertStatements(AO_CS_TableName, AO_CS_InsertableColumnNames, records);
}
