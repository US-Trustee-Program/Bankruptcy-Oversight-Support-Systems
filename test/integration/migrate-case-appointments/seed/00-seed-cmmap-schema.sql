-- CMMAP DDL: creates the table used by migrate-case-appointments integration tests.
-- Run against ACMS_INT database (created by seed-schema command).

IF OBJECT_ID('dbo.CMMAP', 'U') IS NOT NULL DROP TABLE dbo.CMMAP;
GO

CREATE TABLE dbo.CMMAP (
  RECORD_SEQ_NBR  NUMERIC(5,0) NOT NULL,
  CASE_DIV        NUMERIC(3,0) NOT NULL,
  CASE_YEAR       NUMERIC(2,0) NOT NULL,
  CASE_NUMBER     NUMERIC(5,0) NOT NULL,
  GROUP_DESIGNATOR CHAR(2)     NOT NULL,
  PROF_CODE       NUMERIC(5,0) NOT NULL,
  APPT_DATE       NUMERIC(8,0) NOT NULL,  -- YYYYMMDD integer, 0 = null
  DISP_DATE       NUMERIC(8,0),           -- YYYYMMDD integer, 0 = null
  DELETE_CODE     CHAR(1)      NOT NULL DEFAULT ' ',
  APPTEE_ACTIVE   CHAR(1)      NOT NULL DEFAULT 'Y',
  id              INT IDENTITY(1,1),
  PRIMARY KEY (CASE_DIV, CASE_YEAR, CASE_NUMBER, RECORD_SEQ_NBR)
);
GO
