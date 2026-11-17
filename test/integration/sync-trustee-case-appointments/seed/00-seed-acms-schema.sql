-- ACMS replica DDL for the sync-trustee-case-appointments harness (ACMS_INT database).
--
-- GROUND TRUTH: column names and join keys below are taken from the production query
-- AcmsGateway.getCmmapAppointmentsRaw (backend/lib/adapters/gateways/acms/acms.gateway.ts) and the
-- ACMS data dictionary (cams-gateways skill, acms-schema/CMMAP.md, CMMPR.md). Notably:
--   * CMMAP.PROF_CODE joins CMMPR.UST_PROF_CODE (both with GROUP_DESIGNATOR). CMMAP has no
--     UST_PROF_CODE column.
--   * CMMAP.REGION_CODE and CMMAP.CDB_UPDATE_DATE drive the per-region, per-change-date read.
-- Only columns the sync reads are declared. If getCmmapAppointmentsRaw starts reading another
-- column, add it here -- this DDL is hand-maintained and can drift (see ../../README.md).
-- This file deliberately duplicates other harnesses' ACMS DDL so this directory can be deleted alone.

IF OBJECT_ID('dbo.CMMAP', 'U') IS NOT NULL DROP TABLE dbo.CMMAP;
GO

CREATE TABLE dbo.CMMAP (
  RECORD_SEQ_NBR   NUMERIC(5,0)  NOT NULL,
  CASE_DIV         NUMERIC(3,0)  NOT NULL,
  CASE_YEAR        NUMERIC(2,0)  NOT NULL,
  CASE_NUMBER      NUMERIC(5,0)  NOT NULL,
  GROUP_DESIGNATOR CHAR(2)       NOT NULL,
  PROF_CODE        NUMERIC(5,0)  NOT NULL,
  APPT_TYPE        CHAR(2)       NOT NULL DEFAULT '  ',  -- 'TR' = trustee
  APPT_DATE        NUMERIC(11,0) NOT NULL DEFAULT 0,     -- YYYYMMDD, 0 = none
  DISP_DATE        NUMERIC(11,0) NOT NULL DEFAULT 0,     -- YYYYMMDD, 0 = still open
  DELETE_CODE      CHAR(1)       NOT NULL DEFAULT ' ',   -- 'D' = deleted
  REGION_CODE      CHAR(2)       NOT NULL,
  CDB_UPDATE_DATE  NUMERIC(8,0)  NOT NULL,               -- YYYYMMDD, row last changed in the CDB
  id               BIGINT        IDENTITY(1,1),
  PRIMARY KEY (CASE_DIV, CASE_YEAR, CASE_NUMBER, RECORD_SEQ_NBR)
);
GO

IF OBJECT_ID('dbo.CMMDB', 'U') IS NOT NULL DROP TABLE dbo.CMMDB;
GO

CREATE TABLE dbo.CMMDB (
  CASE_DIV              NUMERIC(3,0) NOT NULL,
  CASE_YEAR             NUMERIC(2,0) NOT NULL,
  CASE_NUMBER           NUMERIC(5,0) NOT NULL,
  DELETE_CODE           CHAR(1)      NOT NULL DEFAULT ' ',
  CASE_FILED_DATE       NUMERIC(8,0) NOT NULL DEFAULT 0,
  CURR_CASE_CHAPT       CHAR(2)      NOT NULL DEFAULT '  ',  -- e.g. '7 ', '11', '7A', '7N', '13'
  CLOSED_BY_COURT_DATE  NUMERIC(8,0) NOT NULL DEFAULT 0,
  CLOSED_BY_UST_DATE    NUMERIC(8,0) NOT NULL DEFAULT 0,
  PRIMARY KEY (CASE_DIV, CASE_YEAR, CASE_NUMBER)
);
GO

IF OBJECT_ID('dbo.CMMPR', 'U') IS NOT NULL DROP TABLE dbo.CMMPR;
GO

CREATE TABLE dbo.CMMPR (
  GROUP_DESIGNATOR          CHAR(2)       NOT NULL,
  UST_PROF_CODE             NUMERIC(5,0)  NOT NULL,
  DELETE_CODE               CHAR(1)       NOT NULL DEFAULT ' ',
  PROF_LAST_NAME            CHAR(30)      NOT NULL DEFAULT '',
  PROF_FIRST_NAME           CHAR(20)      NOT NULL DEFAULT '',
  PROF_MI                   CHAR(1)       NOT NULL DEFAULT '',
  PROF_ADDRESS1             CHAR(30)      NOT NULL DEFAULT '',
  PROF_ADDRESS2             CHAR(30)      NOT NULL DEFAULT '',
  PROF_CITY                 CHAR(20)      NOT NULL DEFAULT '',
  PROF_STATE                CHAR(2)       NOT NULL DEFAULT '',
  PROF_ZIP                  NUMERIC(9,0)  NOT NULL DEFAULT 0,
  PROF_COMMERCIAL_PHONE_NBR NUMERIC(10,0) NOT NULL DEFAULT 0,
  PRIMARY KEY (GROUP_DESIGNATOR, UST_PROF_CODE)
);
GO

IF OBJECT_ID('dbo.CMMKE', 'U') IS NOT NULL DROP TABLE dbo.CMMKE;
GO

-- Key events: only the reopening event (EVENT_CODE_TYPE 'O', EVENT_CODE 'OCO') is read.
CREATE TABLE dbo.CMMKE (
  CASE_DIV          NUMERIC(3,0) NOT NULL,
  CASE_YEAR         NUMERIC(2,0) NOT NULL,
  CASE_NUMBER       NUMERIC(5,0) NOT NULL,
  EVENT_CODE_TYPE   CHAR(1)      NOT NULL,
  EVENT_CODE        CHAR(3)      NOT NULL,
  GROUP_DESIGNATOR  CHAR(2)      NOT NULL DEFAULT '  ',
  ORIGINAL_OCC_DATE NUMERIC(8,0) NOT NULL DEFAULT 0,
  PRIMARY KEY (CASE_DIV, CASE_YEAR, CASE_NUMBER, EVENT_CODE_TYPE, EVENT_CODE, GROUP_DESIGNATOR)
);
GO
