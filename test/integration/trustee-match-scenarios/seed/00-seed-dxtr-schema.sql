-- DXTR DDL: creates the tables read by CasesDxtrGateway.getTrusteeAppointments and
-- getTrusteePetitionEvents. Run against DXTR_INT database (created by seed-schema command).
--
-- This is a hand-crafted subset of the real DXTR schema (no authoritative DDL for DXTR
-- exists in this repo) covering only the columns those two queries actually select or
-- join on. See skills/cams-gateways dxtr-schema/ (AO_TX.md, AO_CS.md, AO_CS_DIV.md,
-- AO_PY.md) for the full column reference this was derived from.

IF OBJECT_ID('dbo.AO_TX', 'U') IS NOT NULL DROP TABLE dbo.AO_TX;
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
  CS_DIV      VARCHAR(3) NOT NULL,
  GRP_DES     VARCHAR(2) NOT NULL,
  COURT_ID    VARCHAR(4) NULL,
  CS_DIV_ACMS VARCHAR(3) NULL,
  PRIMARY KEY (CS_DIV, GRP_DES)
);
GO

-- Case master. Compound key (CS_CASEID, COURT_ID) — CS_CASEID alone is NOT unique.
CREATE TABLE dbo.AO_CS (
  CS_CASEID   VARCHAR(9)   NOT NULL,
  COURT_ID    VARCHAR(4)   NOT NULL,
  CASE_ID     VARCHAR(10)  NULL, -- public court case number, e.g. "26-99999"
  CS_DIV      VARCHAR(3)   NOT NULL,
  CS_CHAPTER  VARCHAR(3)   NULL,
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
  PRIMARY KEY (CS_CASEID, COURT_ID, PY_ROLE)
);
GO

-- Transaction records. REC is a fixed-width (237 char) legacy record; the aptDate and
-- profCode fields the gateway reads are packed at different SUBSTRING offsets depending
-- on TX_TYPE/TX_CODE:
--   TR appointment (TX_TYPE='A', TX_CODE='TR'): profCode at REC[17..21], aptDate at REC[24..29]
--   Petition       (TX_TYPE='1', TX_CODE='1'):  profCode at REC[86..90], aptDate at REC[91..96]
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
