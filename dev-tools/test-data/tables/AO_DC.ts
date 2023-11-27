import { ColumnNames, TableRecordHelper } from '../types';
import { toSqlInsertStatements } from '../utility';

/*
use AODATEX_SUB
go

create table dbo.AO_DC
(
    FILE_NAME           varchar(40) not null collate SQL_Latin1_General_CP1_CI_AS
        constraint XPKAO_DC
            primary key nonclustered,
    CS_CASEID           varchar(9) collate SQL_Latin1_General_CP1_CI_AS,
    COURT_ID            varchar(4) collate SQL_Latin1_General_CP1_CI_AS,
    DE_SEQNO            int,
    DM_SEQ              int,
    COURT_STATUS        varchar(3) collate SQL_Latin1_General_CP1_CI_AS,
    ON_COURT_LIST       char collate SQL_Latin1_General_CP1_CI_AS,
    DOWNLOADED          char collate SQL_Latin1_General_CP1_CI_AS,
    UNZIPPED            char collate SQL_Latin1_General_CP1_CI_AS,
    TAGGED              char collate SQL_Latin1_General_CP1_CI_AS,
    XML_CREATED         char collate SQL_Latin1_General_CP1_CI_AS,
    XML_RECOGNIZED      char collate SQL_Latin1_General_CP1_CI_AS,
    XML_UPDATED         char collate SQL_Latin1_General_CP1_CI_AS,
    REGION_COPIED       char collate SQL_Latin1_General_CP1_CI_AS,
    COURT_PDF_DELETED   char collate SQL_Latin1_General_CP1_CI_AS,
    PDF_DELETED         char collate SQL_Latin1_General_CP1_CI_AS,
    XML_DELETED         char collate SQL_Latin1_General_CP1_CI_AS,
    FORM_ID             int,
    DOWNLOADED_DATE     datetime2,
    XML_CREATED_DATE    datetime2,
    XML_UPDATED_DATE    datetime2,
    REGION_COPIED_DATE  datetime2,
    PDF_DELETED_DATE    datetime2,
    XML_DELETED_DATE    datetime2,
    PRE_BK_REFORM       char collate SQL_Latin1_General_CP1_CI_AS,
    REGION_DELETED      char collate SQL_Latin1_General_CP1_CI_AS,
    REGION_DELETED_DATE datetime2,
    PDF_SIZE            int,
    PDF_GZ_SIZE         int,
    COPIED_ST           char collate SQL_Latin1_General_CP1_CI_AS,
    COPIED_ST_DATE      datetime2,
    COPIED_LT           char collate SQL_Latin1_General_CP1_CI_AS,
    COPIED_LT_DATE      datetime2,
    DELETED_ST          char collate SQL_Latin1_General_CP1_CI_AS,
    DELETED_ST_DATE     datetime2,
    DELETED_LT          char collate SQL_Latin1_General_CP1_CI_AS,
    DELETED_LT_DATE     datetime2,
    XMP_CREATED         char collate SQL_Latin1_General_CP1_CI_AS,
    XMP_CREATED_DATE    datetime2,
    XMP_TRANSFORMED     char collate SQL_Latin1_General_CP1_CI_AS,
    XMP_DELETED         char collate SQL_Latin1_General_CP1_CI_AS,
    XMP_DELETED_DATE    datetime2,
    COURT_URL_ID        int,
    PDF_PATH_ID         int,
    CPYBAR              char collate SQL_Latin1_General_CP1_CI_AS
        constraint AO_DC_AO_PDF_STATUS_FK
            references dbo.AO_PDF_STATUS,
    CPYBAR_DATE         datetime,
    BARPROC             char collate SQL_Latin1_General_CP1_CI_AS
        constraint AO_DC_AO_PDF_STATUS_FK1
            references dbo.AO_PDF_STATUS,
    BARPROC_DATE        datetime,
    HADBAR              char collate SQL_Latin1_General_CP1_CI_AS
        constraint AO_DC_AO_PDF_STATUS_FK2
            references dbo.AO_PDF_STATUS,
    HADBAR_DATE         datetime,
    BARXMLUPD           char collate SQL_Latin1_General_CP1_CI_AS
        constraint AO_DC_AO_PDF_STATUS_FK3
            references dbo.AO_PDF_STATUS,
    BARXMLUPD_DATE      datetime,
    BARXMLDEL           char collate SQL_Latin1_General_CP1_CI_AS
        constraint AO_DC_AO_PDF_STATUS_FK4
            references dbo.AO_PDF_STATUS,
    BARXMLDEL_DATE      datetime,
    BARPROC_RETRY       smallint,
    DE_DOCUMENT_NUM     int,
    CPYBAR2             char collate SQL_Latin1_General_CP1_CI_AS
        constraint AO_DC_AO_PDF_STATUS_FK5
            references dbo.AO_PDF_STATUS,
    CPYBAR2_DATE        datetime,
    BARPROC2            char collate SQL_Latin1_General_CP1_CI_AS
        constraint AO_DC_AO_PDF_STATUS_FK6
            references dbo.AO_PDF_STATUS,
    BARPROC2_DATE       datetime,
    HADBAR2             char collate SQL_Latin1_General_CP1_CI_AS
        constraint AO_DC_AO_PDF_STATUS_FK7
            references dbo.AO_PDF_STATUS,
    HADBAR2_DATE        datetime,
    BARPROC2_RETRY      smallint,
    BARXMLUPD2          char collate SQL_Latin1_General_CP1_CI_AS
        constraint AO_DC_AO_PDF_STATUS_FK8
            references dbo.AO_PDF_STATUS,
    BARXMLUPD2_DATE     datetime,
    BARXMLDEL2          char collate SQL_Latin1_General_CP1_CI_AS
        constraint AO_DC_AO_PDF_STATUS_FK9
            references dbo.AO_PDF_STATUS,
    BARXMLDEL2_DATE     datetime
)
go

create index AO_DC_IDX
    on dbo.AO_DC (COURT_ID, COURT_STATUS, REGION_COPIED, REGION_DELETED, REGION_COPIED_DATE) include (FILE_NAME,
                                                                                                      CS_CASEID,
                                                                                                      DE_SEQNO, DM_SEQ,
                                                                                                      ON_COURT_LIST,
                                                                                                      DOWNLOADED,
                                                                                                      UNZIPPED, TAGGED,
                                                                                                      XML_CREATED,
                                                                                                      XML_RECOGNIZED,
                                                                                                      XML_UPDATED,
                                                                                                      COURT_PDF_DELETED,
                                                                                                      PDF_DELETED,
                                                                                                      XML_DELETED,
                                                                                                      FORM_ID,
                                                                                                      DOWNLOADED_DATE,
                                                                                                      XML_CREATED_DATE,
                                                                                                      XML_UPDATED_DATE,
                                                                                                      PDF_DELETED_DATE,
                                                                                                      XML_DELETED_DATE,
                                                                                                      PRE_BK_REFORM,
                                                                                                      REGION_DELETED_DATE,
                                                                                                      PDF_SIZE,
                                                                                                      PDF_GZ_SIZE,
                                                                                                      COPIED_ST,
                                                                                                      COPIED_ST_DATE,
                                                                                                      COPIED_LT,
                                                                                                      COPIED_LT_DATE,
                                                                                                      DELETED_ST,
                                                                                                      DELETED_ST_DATE,
                                                                                                      DELETED_LT,
                                                                                                      DELETED_LT_DATE,
                                                                                                      XMP_CREATED,
                                                                                                      XMP_CREATED_DATE,
                                                                                                      XMP_TRANSFORMED,
                                                                                                      XMP_DELETED,
                                                                                                      XMP_DELETED_DATE,
                                                                                                      COURT_URL_ID,
                                                                                                      PDF_PATH_ID,
                                                                                                      CPYBAR,
                                                                                                      CPYBAR_DATE,
                                                                                                      BARPROC,
                                                                                                      BARPROC_DATE,
                                                                                                      HADBAR,
                                                                                                      HADBAR_DATE,
                                                                                                      BARXMLUPD,
                                                                                                      BARXMLUPD_DATE,
                                                                                                      BARXMLDEL,
                                                                                                      BARXMLDEL_DATE,
                                                                                                      BARPROC_RETRY,
                                                                                                      DE_DOCUMENT_NUM)
go

create index AO_DC_IDX_082622
    on dbo.AO_DC (COURT_ID, COURT_STATUS, COPIED_LT, DELETED_LT) include (FILE_NAME, CS_CASEID, DE_SEQNO, DM_SEQ,
                                                                          ON_COURT_LIST, DOWNLOADED, UNZIPPED, TAGGED,
                                                                          XML_CREATED, XML_RECOGNIZED, XML_UPDATED,
                                                                          REGION_COPIED, COURT_PDF_DELETED, PDF_DELETED,
                                                                          XML_DELETED, FORM_ID, DOWNLOADED_DATE,
                                                                          XML_CREATED_DATE, XML_UPDATED_DATE,
                                                                          REGION_COPIED_DATE, PDF_DELETED_DATE,
                                                                          XML_DELETED_DATE, PRE_BK_REFORM,
                                                                          REGION_DELETED, REGION_DELETED_DATE, PDF_SIZE,
                                                                          PDF_GZ_SIZE, COPIED_ST, COPIED_ST_DATE,
                                                                          COPIED_LT_DATE, DELETED_ST, DELETED_ST_DATE,
                                                                          DELETED_LT_DATE, XMP_CREATED,
                                                                          XMP_CREATED_DATE, XMP_TRANSFORMED,
                                                                          XMP_DELETED, XMP_DELETED_DATE, COURT_URL_ID,
                                                                          PDF_PATH_ID, CPYBAR, CPYBAR_DATE, BARPROC,
                                                                          BARPROC_DATE, HADBAR, HADBAR_DATE, BARXMLUPD,
                                                                          BARXMLUPD_DATE, BARXMLDEL, BARXMLDEL_DATE,
                                                                          BARPROC_RETRY, DE_DOCUMENT_NUM, CPYBAR2,
                                                                          CPYBAR2_DATE, BARPROC2, BARPROC2_DATE,
                                                                          HADBAR2, HADBAR2_DATE, BARPROC2_RETRY,
                                                                          BARXMLUPD2, BARXMLUPD2_DATE, BARXMLDEL2,
                                                                          BARXMLDEL2_DATE)
go

create index AO_DC_IDX_FILENAME
    on dbo.AO_DC (FILE_NAME) include (CS_CASEID, COURT_ID, DE_SEQNO)
go

create index AO_DC_IDX3
    on dbo.AO_DC (COURT_URL_ID) include (FILE_NAME, CS_CASEID, COURT_ID, DE_SEQNO)
go

create index AO_DC_ST_IDX
    on dbo.AO_DC (COURT_ID, COURT_STATUS, COPIED_ST, DELETED_ST, COPIED_ST_DATE) include (FILE_NAME, CS_CASEID,
                                                                                          DE_SEQNO, DM_SEQ,
                                                                                          ON_COURT_LIST, DOWNLOADED,
                                                                                          UNZIPPED, TAGGED, XML_CREATED,
                                                                                          XML_RECOGNIZED, XML_UPDATED,
                                                                                          REGION_COPIED,
                                                                                          COURT_PDF_DELETED,
                                                                                          PDF_DELETED, XML_DELETED,
                                                                                          FORM_ID, DOWNLOADED_DATE,
                                                                                          XML_CREATED_DATE,
                                                                                          XML_UPDATED_DATE,
                                                                                          REGION_COPIED_DATE,
                                                                                          PDF_DELETED_DATE,
                                                                                          XML_DELETED_DATE,
                                                                                          PRE_BK_REFORM, REGION_DELETED,
                                                                                          REGION_DELETED_DATE, PDF_SIZE,
                                                                                          PDF_GZ_SIZE, COPIED_LT,
                                                                                          COPIED_LT_DATE,
                                                                                          DELETED_ST_DATE, DELETED_LT,
                                                                                          DELETED_LT_DATE, XMP_CREATED,
                                                                                          XMP_CREATED_DATE,
                                                                                          XMP_TRANSFORMED, XMP_DELETED,
                                                                                          XMP_DELETED_DATE,
                                                                                          COURT_URL_ID, PDF_PATH_ID,
                                                                                          CPYBAR, CPYBAR_DATE, BARPROC,
                                                                                          BARPROC_DATE, HADBAR,
                                                                                          HADBAR_DATE, BARXMLUPD,
                                                                                          BARXMLUPD_DATE, BARXMLDEL,
                                                                                          BARXMLDEL_DATE, BARPROC_RETRY,
                                                                                          DE_DOCUMENT_NUM)
go

create index case_viewer_cs_caseid_idx_082719
    on dbo.AO_DC (CS_CASEID, COURT_ID, DE_SEQNO, PDF_PATH_ID, DM_SEQ, FILE_NAME) include (REGION_COPIED,
                                                                                          REGION_COPIED_DATE,
                                                                                          REGION_DELETED, COPIED_LT,
                                                                                          COPIED_LT_DATE, DELETED_LT)
go

create index index_AO_DC_COURT_ID_CS_CASEID_REGION_COPIED
    on dbo.AO_DC (COURT_ID, CS_CASEID, REGION_COPIED, REGION_DELETED, COPIED_LT, COPIED_ST, DELETED_ST, DELETED_LT,
                  DE_SEQNO, PDF_PATH_ID, FILE_NAME)
go

create index TUFR_IDX_10032011
    on dbo.AO_DC (FILE_NAME, COPIED_LT, DELETED_LT, PDF_PATH_ID)
go

create index XIE1AO_DC
    on dbo.AO_DC (COURT_ID, CS_CASEID)
go

create index XIE2AO_DC
    on dbo.AO_DC (COURT_ID)
go

create index XIE3AO_DC
    on dbo.AO_DC (DOWNLOADED_DATE, PDF_SIZE, FORM_ID, DE_SEQNO, CS_CASEID, COURT_ID)
go

create index XIF104AO_DC
    on dbo.AO_DC (ON_COURT_LIST)
go

create index XIF107AO_DC
    on dbo.AO_DC (DOWNLOADED)
go

create index XIF108AO_DC
    on dbo.AO_DC (UNZIPPED)
go

create index XIF109AO_DC
    on dbo.AO_DC (REGION_COPIED)
go

create index XIF110AO_DC
    on dbo.AO_DC (TAGGED)
go

create index XIF111AO_DC
    on dbo.AO_DC (XML_CREATED)
go

create index XIF112AO_DC
    on dbo.AO_DC (XML_UPDATED)
go

create index XIF113AO_DC
    on dbo.AO_DC (COURT_PDF_DELETED)
go

create index XIF114AO_DC
    on dbo.AO_DC (XML_DELETED)
go

create index XIF116AO_DC
    on dbo.AO_DC (PDF_DELETED)
go

create index XIF117AO_DC
    on dbo.AO_DC (COURT_STATUS)
go

create index XIF132AO_DC
    on dbo.AO_DC (XML_RECOGNIZED)
go

create index XIF138AO_DC
    on dbo.AO_DC (PRE_BK_REFORM)
go

create index XIF139AO_DC
    on dbo.AO_DC (REGION_DELETED)
go

create index XIF140AO_DC
    on dbo.AO_DC (BARXMLUPD2)
go

create index XIF1AO_DC
    on dbo.AO_DC (CS_CASEID, COURT_ID, DE_SEQNO)
go

*/

export const AO_DC_TableName = 'AO_DC';
// Note all column names have not been added here. Just the columns we are currently using from DXTR.
export const AO_DC_InsertableColumnNames: ColumnNames = [
  'FILE_NAME',
  'CS_CASEID',
  'COURT_ID',
  'DE_SEQNO',
  'DM_SEQ',
  'PDF_SIZE',
];
export const AO_DC_ColumnNames: ColumnNames = [...AO_DC_InsertableColumnNames];
export interface AO_DC_RecordProps {
  FILE_NAME: string;
  CS_CASEID?: string;
  COURT_ID?: string;
  DE_SEQNO?: number;
  DM_SEQ?: number;
  PDF_SIZE?: number;
}
export class AO_DC_Record implements TableRecordHelper {
  FILE_NAME: string = '';
  CS_CASEID?: string;
  COURT_ID?: string;
  DE_SEQNO?: number;
  DM_SEQ?: number;
  PDF_SIZE?: number;

  constructor(props: AO_DC_RecordProps) {
    Object.assign(this, props);
  }
  validate(): void {
    /// TODO: implement this schema validation
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toInsertableArray(): any[] {
    return [
      this.FILE_NAME,
      this.CS_CASEID,
      this.COURT_ID,
      this.DE_SEQNO,
      this.DM_SEQ,
      this.PDF_SIZE,
    ];
  }
}
export function toAoDcInsertStatements(records: Array<AO_DC_Record>): string[] {
  return toSqlInsertStatements(AO_DC_TableName, AO_DC_InsertableColumnNames, records);
}

export const AO_DE_CourtStatus = ['fa', 'na', 'pdf', 'unk'] as const;
