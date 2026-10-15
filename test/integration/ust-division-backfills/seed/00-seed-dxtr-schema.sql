-- Minimal DXTR offices DDL: AO_CS_DIV, AO_OFFICE, AO_COURT, AO_GRP_DES,
-- AO_REGION — the 5-table join OfficesDxtrGateway.getOffices() queries.
--
-- This harness needs a real (non-mocked) DXTR database because
-- backfill-appointment-ust-division-codes resolves its ACMS -> bare code map from
-- getOffices(), whose ustDivisionCode column is the CASE expression built by
-- ustDivisionCodeSelect (CAMS-936). Unit tests can only assert that SQL's text; only a
-- real query proves it returns the bare CS_DIV inside court 0649 and CS_DIV_ACMS outside it.
--
-- Mirrors sync-acms-professional-ids/seed/00-seed-dxtr-offices-schema.sql — keep the two in
-- step if the real DXTR shape changes.
-- Run against DXTR_INT database (created by the seed-schema command).

IF OBJECT_ID('dbo.AO_CS_DIV', 'U') IS NOT NULL DROP TABLE dbo.AO_CS_DIV;
GO

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

IF OBJECT_ID('dbo.AO_OFFICE', 'U') IS NOT NULL DROP TABLE dbo.AO_OFFICE;
GO

CREATE TABLE dbo.AO_OFFICE (
  COURT_ID             VARCHAR(4)   NOT NULL,
  OFFICE_CODE          CHAR(1)      NOT NULL,
  OFFICE_NAME          VARCHAR(110) NULL,
  OFFICE_NAME_DISPLAY  VARCHAR(110) NULL,
  CAMS                 CHAR(1)      NOT NULL DEFAULT 'N',
  PRIMARY KEY (COURT_ID, OFFICE_CODE)
);
GO

IF OBJECT_ID('dbo.AO_COURT', 'U') IS NOT NULL DROP TABLE dbo.AO_COURT;
GO

CREATE TABLE dbo.AO_COURT (
  COURT_ID        VARCHAR(4)  NOT NULL,
  COURT_TITLE     VARCHAR(30) NULL,
  COURT_NAME      VARCHAR(40) NULL,
  DISTRICT_ALPHA  VARCHAR(3)  NULL,
  PRIMARY KEY (COURT_ID)
);
GO

IF OBJECT_ID('dbo.AO_GRP_DES', 'U') IS NOT NULL DROP TABLE dbo.AO_GRP_DES;
GO

CREATE TABLE dbo.AO_GRP_DES (
  GRP_DES    VARCHAR(2) NOT NULL,
  REGION_ID  VARCHAR(2) NOT NULL,
  PRIMARY KEY (GRP_DES)
);
GO

IF OBJECT_ID('dbo.AO_REGION', 'U') IS NOT NULL DROP TABLE dbo.AO_REGION;
GO

CREATE TABLE dbo.AO_REGION (
  REGION_ID    VARCHAR(2)  NOT NULL,
  REGION_NAME  VARCHAR(20) NULL,
  PRIMARY KEY (REGION_ID)
);
GO
