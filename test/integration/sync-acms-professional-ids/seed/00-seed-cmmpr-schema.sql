-- CMMPR DDL: creates the ACMS Professional Master File table used by
-- sync-acms-professional-ids integration tests. Also creates CMMAP/CMMDB —
-- reused from migrate-case-appointments' schema — for the active-appointment
-- gate query (getActiveAppointmentsForProfessional joins CMMAP to CMMDB).
-- Run against ACMS_INT database (created by seed-schema command).

IF OBJECT_ID('dbo.CMMPR', 'U') IS NOT NULL DROP TABLE dbo.CMMPR;
GO

CREATE TABLE dbo.CMMPR (
  GROUP_DESIGNATOR CHAR(2)        NOT NULL,
  UST_PROF_CODE    NUMERIC(5,0)   NOT NULL,
  DELETE_CODE      CHAR(1)        NOT NULL DEFAULT ' ',
  PROF_TYPE        CHAR(2)        NOT NULL DEFAULT '  ',
  PROF_LAST_NAME   CHAR(30)       NOT NULL DEFAULT '',
  PROF_FIRST_NAME  CHAR(20)       NOT NULL DEFAULT '',
  PROF_MI          CHAR(1)        NOT NULL DEFAULT '',
  PROF_ADDRESS1    CHAR(30)       NOT NULL DEFAULT '',
  PROF_ADDRESS2    CHAR(30)       NOT NULL DEFAULT '',
  PROF_CITY        CHAR(20)       NOT NULL DEFAULT '',
  PROF_STATE       CHAR(2)        NOT NULL DEFAULT '',
  PROF_ZIP         NUMERIC(9,0)   NOT NULL DEFAULT 0,
  PROF_FAX_NBR     NUMERIC(10,0)  NOT NULL DEFAULT 0,
  PROF_COMMERCIAL_PHONE_NBR NUMERIC(10,0) NOT NULL DEFAULT 0,
  PRIMARY KEY (GROUP_DESIGNATOR, UST_PROF_CODE)
);
GO

IF OBJECT_ID('dbo.CMMAP', 'U') IS NOT NULL DROP TABLE dbo.CMMAP;
GO

-- Same shape as migrate-case-appointments' CMMAP — reused here for the
-- active-appointment gate query (getActiveAppointmentsForProfessional).
CREATE TABLE dbo.CMMAP (
  RECORD_SEQ_NBR  NUMERIC(5,0)  NOT NULL,
  CASE_DIV        NUMERIC(3,0)  NOT NULL,
  CASE_YEAR       NUMERIC(2,0)  NOT NULL,
  CASE_NUMBER     NUMERIC(5,0)  NOT NULL,
  GROUP_DESIGNATOR CHAR(2)      NOT NULL,
  PROF_CODE       NUMERIC(5,0)  NOT NULL,
  APPT_DATE       NUMERIC(8,0)  NOT NULL,  -- YYYYMMDD integer, 0 = null
  DISP_DATE       NUMERIC(8,0),            -- YYYYMMDD integer, 0 or NULL = active
  DELETE_CODE     CHAR(1)       NOT NULL DEFAULT ' ',
  APPTEE_ACTIVE   CHAR(1)       NOT NULL DEFAULT 'Y',
  APPT_TYPE       CHAR(2)       NOT NULL DEFAULT '  ',
  id              BIGINT        IDENTITY(1,1),
  PRIMARY KEY (CASE_DIV, CASE_YEAR, CASE_NUMBER, RECORD_SEQ_NBR)
);
GO

IF OBJECT_ID('dbo.CMMDB', 'U') IS NOT NULL DROP TABLE dbo.CMMDB;
GO

-- Minimal CMMDB (Debtor Master File) — only the columns the active-appointment
-- gate's CMMAP-to-CMMDB join needs (division + chapter).
CREATE TABLE dbo.CMMDB (
  CASE_DIV              NUMERIC(3,0)  NOT NULL,
  CASE_YEAR             NUMERIC(2,0)  NOT NULL,
  CASE_NUMBER           NUMERIC(5,0)  NOT NULL,
  DELETE_CODE           CHAR(1)       NOT NULL DEFAULT ' ',
  CURR_CASE_CHAPT       CHAR(2)       NOT NULL DEFAULT '  ',
  PRIMARY KEY (CASE_DIV, CASE_YEAR, CASE_NUMBER)
);
GO
