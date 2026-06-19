-- CMMAP and CMMDB DDL: creates tables used by migrate-case-appointments integration tests.
-- Run against ACMS_INT database (created by seed-schema command).

IF OBJECT_ID('dbo.CMMAP', 'U') IS NOT NULL DROP TABLE dbo.CMMAP;
GO

CREATE TABLE dbo.CMMAP (
  RECORD_SEQ_NBR  NUMERIC(5,0)  NOT NULL,
  CASE_DIV        NUMERIC(3,0)  NOT NULL,
  CASE_YEAR       NUMERIC(2,0)  NOT NULL,
  CASE_NUMBER     NUMERIC(5,0)  NOT NULL,
  GROUP_DESIGNATOR CHAR(2)      NOT NULL,
  PROF_CODE       NUMERIC(5,0)  NOT NULL,
  APPT_DATE       NUMERIC(8,0)  NOT NULL,  -- YYYYMMDD integer, 0 = null
  DISP_DATE       NUMERIC(8,0),            -- YYYYMMDD integer, 0 = null
  DELETE_CODE     CHAR(1)       NOT NULL DEFAULT ' ',
  APPTEE_ACTIVE   CHAR(1)       NOT NULL DEFAULT 'Y',
  APPT_TYPE       CHAR(2)       NOT NULL DEFAULT '  ',
  id              BIGINT        IDENTITY(1,1),
  PRIMARY KEY (CASE_DIV, CASE_YEAR, CASE_NUMBER, RECORD_SEQ_NBR)
);
GO

IF OBJECT_ID('dbo.CMMDB', 'U') IS NOT NULL DROP TABLE dbo.CMMDB;
GO

-- Minimal CMMDB (Debtor Master File) — only the columns needed for the case age JOIN.
CREATE TABLE dbo.CMMDB (
  CASE_DIV              NUMERIC(3,0)  NOT NULL,
  CASE_YEAR             NUMERIC(2,0)  NOT NULL,
  CASE_NUMBER           NUMERIC(5,0)  NOT NULL,
  CLOSED_BY_COURT_DATE  NUMERIC(8,0)  NOT NULL DEFAULT 0,  -- YYYYMMDD, 0 = open
  CLOSED_BY_UST_DATE    NUMERIC(8,0)  NOT NULL DEFAULT 0,  -- YYYYMMDD, 0 = open
  DELETE_CODE           CHAR(1)       NOT NULL DEFAULT ' ',
  PRIMARY KEY (CASE_DIV, CASE_YEAR, CASE_NUMBER)
);
GO
