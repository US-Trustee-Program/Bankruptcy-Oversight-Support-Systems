-- DXTR DDL (copied from trustee-match-scenarios, with the office tables widened to the shape
-- OfficesDxtrGateway.getOffices() queries, copied from sync-acms-professional-ids; duplicated on purpose
-- so this directory can be deleted alone). Creates the tables read by CasesDxtrGateway.getTrusteeAppointments,
-- getTrusteePetitionEvents, and (for Stage 10's gate A check) getCaseSummary. Run against
-- DXTR_INT database (created by seed-schema command).
--
-- This is a hand-crafted subset of the real DXTR schema (no authoritative DDL for DXTR
-- exists in this repo) covering only the columns those two queries actually select or
-- join on. See skills/cams-gateways dxtr-schema/ (AO_TX.md, AO_CS.md, AO_CS_DIV.md,
-- AO_PY.md) for the full column reference this was derived from.

IF OBJECT_ID('dbo.AO_TX', 'U') IS NOT NULL DROP TABLE dbo.AO_TX;
GO

IF OBJECT_ID('dbo.AO_ALIAS', 'U') IS NOT NULL DROP TABLE dbo.AO_ALIAS;
GO

IF OBJECT_ID('dbo.AO_SSN', 'U') IS NOT NULL DROP TABLE dbo.AO_SSN;
GO

IF OBJECT_ID('dbo.AO_TAXID', 'U') IS NOT NULL DROP TABLE dbo.AO_TAXID;
GO

IF OBJECT_ID('dbo.AO_OFFICE', 'U') IS NOT NULL DROP TABLE dbo.AO_OFFICE;
GO

IF OBJECT_ID('dbo.AO_COURT', 'U') IS NOT NULL DROP TABLE dbo.AO_COURT;
GO

IF OBJECT_ID('dbo.AO_GRP_DES', 'U') IS NOT NULL DROP TABLE dbo.AO_GRP_DES;
GO

IF OBJECT_ID('dbo.AO_REGION', 'U') IS NOT NULL DROP TABLE dbo.AO_REGION;
GO

IF OBJECT_ID('dbo.AO_PY', 'U') IS NOT NULL DROP TABLE dbo.AO_PY;
GO

IF OBJECT_ID('dbo.AO_CS', 'U') IS NOT NULL DROP TABLE dbo.AO_CS;
GO

IF OBJECT_ID('dbo.AO_CS_DIV', 'U') IS NOT NULL DROP TABLE dbo.AO_CS_DIV;
GO

-- Division/district mapping. CS_DIV_ACMS is the 3-digit division code used to build
-- CAMS case IDs and courtDivisionCode; GRP_DES feeds acmsProfessionalId's group prefix.
CREATE TABLE dbo.AO_CS_DIV (
  CS_DIV        VARCHAR(3)  NOT NULL,
  GRP_DES       VARCHAR(2)  NOT NULL,
  COURT_ID      VARCHAR(4)  NOT NULL,
  OFFICE_CODE   CHAR(1)     NOT NULL,
  STATE         VARCHAR(2)  NOT NULL,
  NBDB          VARCHAR(3)  NULL,
  PDF_PATH_ID   BIGINT      NULL,
  CS_DIV_ACMS   VARCHAR(3)  NULL,
  CS_DIV_NBDB   VARCHAR(3)  NULL,
  PRIMARY KEY (CS_DIV, GRP_DES)
);
GO

-- Case master. Compound key (CS_CASEID, COURT_ID) — CS_CASEID alone is NOT unique. GRP_DES here
-- is the case's own group designator (read directly by the trustee-appointment-events query as
-- groupDesignator) — a distinct column from AO_CS_DIV.GRP_DES, which keys the division's group
-- membership, not the case's.
CREATE TABLE dbo.AO_CS (
  CS_CASEID   VARCHAR(9)   NOT NULL,
  COURT_ID    VARCHAR(4)   NOT NULL,
  CASE_ID     VARCHAR(10)  NULL, -- public court case number, e.g. "26-99999"
  CS_DIV      VARCHAR(3)   NOT NULL,
  CS_CHAPTER  VARCHAR(3)   NULL,
  GRP_DES     VARCHAR(2)   NULL,
  -- Read only by getCaseSummary (Stage 10); null for every other scenario.
  CS_SHORT_TITLE VARCHAR(80) NULL,
  CS_DATE_FILED  DATETIME2   NULL,
  JD_FIRST_NAME  VARCHAR(30) NULL,
  JD_MIDDLE_NAME VARCHAR(25) NULL,
  JD_LAST_NAME   VARCHAR(30) NULL,
  PRIMARY KEY (CS_CASEID, COURT_ID)
);
GO

-- Party information. PY_ROLE='tr' rows are the case trustee read by both queries.
CREATE TABLE dbo.AO_PY (
  CS_CASEID      VARCHAR(9)  NOT NULL,
  COURT_ID       VARCHAR(4)  NOT NULL,
  PY_ROLE        VARCHAR(2)  NOT NULL,
  PY_FIRST_NAME  VARCHAR(30) NULL,
  PY_MIDDLE_NAME VARCHAR(25) NULL,
  PY_LAST_NAME   VARCHAR(200) NULL,
  PY_GENERATION  VARCHAR(9)  NULL,
  PY_ADDRESS1    VARCHAR(60) NULL,
  PY_ADDRESS2    VARCHAR(60) NULL,
  PY_ADDRESS3    VARCHAR(60) NULL,
  PY_CITY        VARCHAR(30) NULL,
  PY_STATE       VARCHAR(2)  NULL,
  PY_ZIP         VARCHAR(13) NULL,
  PY_COUNTRY     VARCHAR(40) NULL,
  PY_PHONENO     VARCHAR(30) NULL,
  PY_FAX_PHONE   VARCHAR(20) NULL,
  PY_E_MAIL      VARCHAR(60) NULL,
  PY_TAXID       VARCHAR(10) NULL, -- read by getCaseSummary's debtor query
  PY_SSN         VARCHAR(11) NULL, -- read by getCaseSummary's debtor query
  PRIMARY KEY (CS_CASEID, COURT_ID, PY_ROLE)
);
GO

-- Transaction records. REC is a fixed-width (237 char) legacy record; the aptDate field the
-- gateway reads is packed at a different SUBSTRING offset depending on TX_TYPE/TX_CODE:
--   TR appointment (TX_TYPE='A', TX_CODE='TR'): aptDate at REC[24..29]
--   Petition       (TX_TYPE='1', TX_CODE='1'):  aptDate at REC[91..96]
-- DXTR can supply an incorrect ACMS professional code, so profCode (REC[17..21]/[86..90]) must
-- never be trusted as an auto-link identity signal — it's read solely to detect the
-- "00000"/"99999" sentinel placeholders for the pre-match skip rule (never to pick a trustee).
-- TX_ID is a BIGINT identity serving as the primary key.
CREATE TABLE dbo.AO_TX (
  TX_ID     BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  CS_CASEID VARCHAR(9)   NOT NULL,
  COURT_ID  VARCHAR(4)   NOT NULL,
  TX_TYPE   CHAR(1)      NOT NULL,
  TX_CODE   VARCHAR(3)   NOT NULL,
  TX_DATE   DATETIME2    NOT NULL,
  REC       VARCHAR(237) NOT NULL
);
GO

-- Reference tables joined by getCaseSummary's case query (Stage 10's gate A check), and the
-- party-identifier tables its debtor query unions over (left empty). Same shapes as
-- ../../sync-acms-professional-ids/seed/00-seed-dxtr-offices-schema.sql.
CREATE TABLE dbo.AO_OFFICE (
  COURT_ID             VARCHAR(4)   NOT NULL,
  OFFICE_CODE          CHAR(1)      NOT NULL,
  OFFICE_NAME          VARCHAR(110) NULL,
  OFFICE_NAME_DISPLAY  VARCHAR(110) NULL,
  CAMS                 CHAR(1)      NOT NULL DEFAULT 'N',
  PRIMARY KEY (COURT_ID, OFFICE_CODE)
);
GO

CREATE TABLE dbo.AO_COURT (
  COURT_ID        VARCHAR(4)  NOT NULL,
  COURT_TITLE     VARCHAR(30) NULL,
  COURT_NAME      VARCHAR(40) NULL,
  DISTRICT_ALPHA  VARCHAR(3)  NULL,
  PRIMARY KEY (COURT_ID)
);
GO

CREATE TABLE dbo.AO_GRP_DES (
  GRP_DES    VARCHAR(2) NOT NULL,
  REGION_ID  VARCHAR(2) NOT NULL,
  PRIMARY KEY (GRP_DES)
);
GO

CREATE TABLE dbo.AO_REGION (
  REGION_ID    VARCHAR(2)  NOT NULL,
  REGION_NAME  VARCHAR(20) NULL,
  PRIMARY KEY (REGION_ID)
);
GO

CREATE TABLE dbo.AO_ALIAS (
  CS_CASEID      VARCHAR(9)   NOT NULL,
  COURT_ID       VARCHAR(4)   NOT NULL,
  PY_ROLE        VARCHAR(2)   NOT NULL,
  PY_FIRST_NAME  VARCHAR(30)  NULL,
  PY_MIDDLE_NAME VARCHAR(25)  NULL,
  PY_LAST_NAME   VARCHAR(200) NULL,
  PY_GENERATION  VARCHAR(9)   NULL
);
GO

CREATE TABLE dbo.AO_SSN (
  CS_CASEID   VARCHAR(9)  NOT NULL,
  COURT_ID    VARCHAR(4)  NOT NULL,
  PY_ROLE     VARCHAR(2)  NOT NULL,
  PY_SSN      VARCHAR(11) NULL,
  PY_SSN_SEQ  INT         NOT NULL
);
GO

CREATE TABLE dbo.AO_TAXID (
  CS_CASEID     VARCHAR(9)  NOT NULL,
  COURT_ID      VARCHAR(4)  NOT NULL,
  PY_ROLE       VARCHAR(2)  NOT NULL,
  PY_TAXID      VARCHAR(10) NULL,
  PY_TAXID_SEQ  INT         NOT NULL
);
GO
