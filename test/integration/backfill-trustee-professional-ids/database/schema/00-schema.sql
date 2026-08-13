-- ACMS DDL for the backfill-trustee-professional-ids integration harness.
-- Run against ACMS_INT (created by the harness's seed-schema command).
--
-- This is a hand-crafted subset of the real ACMS schema (no authoritative DDL for ACMS
-- exists in this repo) covering only the columns the THREE new/widened gateway methods this
-- harness exercises actually select or join on:
--   - AcmsGatewayImpl.getAllTrusteeProfessionalRecords  (CMMPR, widened -- CAMS-2-bko.1)
--   - AcmsGatewayImpl.getCmmapAppointmentsForProfessionalIds  (CMMAP INNER JOIN CMMDB, new
--     batched-by-professional-id query -- CAMS-2-bko.2)
--   - AcmsGatewayImpl.getDivisionToCourtMap  (CMMDO, new live join -- CAMS-2-bko.3)
--
-- CMMAP/CMMDB column shapes are adapted from the existing local DDL at
-- test/integration/migrate-case-appointments/seed/00-seed-cmmap-schema.sql (which already
-- covers what getCmmapAppointmentsForProfessionalIds needs -- CASE_DIV/CASE_YEAR/CASE_NUMBER,
-- GROUP_DESIGNATOR/PROF_CODE, DELETE_CODE, APPT_TYPE on CMMAP; CURR_CASE_CHAPT/DELETE_CODE on
-- CMMDB) -- reused verbatim rather than re-derived, since this harness's query drops that
-- migration's open-case filter and CMMKE join but reuses the same join keys and PROF_TYPE='TR'
-- appointment shape. CMMKE is NOT created here -- getCmmapAppointmentsForProfessionalIds does
-- not join it (that's precisely the point of the new query -- see the converged design doc's
-- "Appointment-context query shape" section).
--
-- CMMPR columns are the union of the two existing local CMMPR DDL variants in this repo
-- (test/integration/migrate-trustees/seed/05-seed-heal-cmmpr.sql, which has
-- GROUP_DESIGNATOR/UST_PROF_CODE/PROF_TYPE; test/integration/acms-cams-transition/seed/
-- 01-seed-acms-replica.sql, which has PROF_MI/PROF_ADDRESS1/2/PROF_CITY/PROF_ZIP) plus
-- PROF_COMMERCIAL_PHONE_NBR, which no existing local fixture set covers -- needed by the
-- widened getAllTrusteeProfessionalRecords query (CAMS-2-bko.1).
--
-- CMMDO (Division/Office Master File) is entirely NEW -- no existing fixture set in this repo
-- covers it. Authored from scratch here, from the columns getDivisionToCourtMap actually
-- selects (CASE_DIV, COURT_ID, DELETE_CODE) -- see acms.gateway.ts's getDivisionToCourtMap.

IF OBJECT_ID('dbo.CMMPR', 'U') IS NOT NULL DROP TABLE dbo.CMMPR;
GO

CREATE TABLE dbo.CMMPR (
  DELETE_CODE               CHAR(1)       NOT NULL DEFAULT ' ',
  GROUP_DESIGNATOR          CHAR(2)       NOT NULL,
  UST_PROF_CODE             NUMERIC(5,0)  NOT NULL,
  PROF_FIRST_NAME           CHAR(20),
  PROF_LAST_NAME            CHAR(30),
  PROF_MI                   CHAR(1),
  PROF_ADDRESS1             CHAR(30),
  PROF_ADDRESS2             CHAR(30),
  PROF_CITY                 CHAR(20),
  PROF_STATE                CHAR(2),
  PROF_ZIP                  NUMERIC(9,0),
  PROF_COMMERCIAL_PHONE_NBR NUMERIC(10,0),
  PROF_TYPE                 CHAR(2),
  UPDATE_DATE               DATETIME2(3),
  PRIMARY KEY (GROUP_DESIGNATOR, UST_PROF_CODE)
);
GO

IF OBJECT_ID('dbo.CMMAP', 'U') IS NOT NULL DROP TABLE dbo.CMMAP;
GO

CREATE TABLE dbo.CMMAP (
  RECORD_SEQ_NBR    NUMERIC(5,0)  NOT NULL,
  CASE_DIV          NUMERIC(3,0)  NOT NULL,
  CASE_YEAR         NUMERIC(2,0)  NOT NULL,
  CASE_NUMBER       NUMERIC(5,0)  NOT NULL,
  GROUP_DESIGNATOR  CHAR(2)       NOT NULL,
  PROF_CODE         NUMERIC(5,0)  NOT NULL,
  APPT_DATE         NUMERIC(8,0)  NOT NULL,  -- YYYYMMDD integer, 0 = null
  DISP_DATE         NUMERIC(8,0),            -- YYYYMMDD integer, 0 = null
  DELETE_CODE       CHAR(1)       NOT NULL DEFAULT ' ',
  APPTEE_ACTIVE     CHAR(1)       NOT NULL DEFAULT 'Y',
  APPT_TYPE         CHAR(2)       NOT NULL DEFAULT '  ',
  id                BIGINT        IDENTITY(1,1),
  PRIMARY KEY (CASE_DIV, CASE_YEAR, CASE_NUMBER, RECORD_SEQ_NBR)
);
GO

IF OBJECT_ID('dbo.CMMDB', 'U') IS NOT NULL DROP TABLE dbo.CMMDB;
GO

-- Minimal CMMDB (Debtor Master File) -- columns needed for the CMMAP join and the
-- (deliberately unfiltered-on, but still selected) closed-case/chapter columns.
CREATE TABLE dbo.CMMDB (
  CASE_DIV              NUMERIC(3,0)  NOT NULL,
  CASE_YEAR             NUMERIC(2,0)  NOT NULL,
  CASE_NUMBER           NUMERIC(5,0)  NOT NULL,
  CLOSED_BY_COURT_DATE  NUMERIC(8,0)  NOT NULL DEFAULT 0,  -- YYYYMMDD, 0 = open
  CLOSED_BY_UST_DATE    NUMERIC(8,0)  NOT NULL DEFAULT 0,  -- YYYYMMDD, 0 = open
  DELETE_CODE           CHAR(1)       NOT NULL DEFAULT ' ',
  CASE_FILED_DATE       NUMERIC(8,0)  NOT NULL DEFAULT 0,  -- YYYYMMDD, 0 = unknown
  CURR_CASE_CHAPT       CHAR(2)       NOT NULL DEFAULT '  ',
  PRIMARY KEY (CASE_DIV, CASE_YEAR, CASE_NUMBER)
);
GO

IF OBJECT_ID('dbo.CMMDO', 'U') IS NOT NULL DROP TABLE dbo.CMMDO;
GO

-- CMMDO (Division/Office Master File) -- NEW, no existing fixture set in this repo covers it.
-- ~271 rows in production; getDivisionToCourtMap fetches the whole (non-deleted) table live,
-- once per dataflow run, rather than a hand-copied static TypeScript table (see the converged
-- design doc's "District/chapter" section). Only the three columns the gateway query actually
-- selects/filters on are modeled: CASE_DIV, COURT_ID, DELETE_CODE.
CREATE TABLE dbo.CMMDO (
  CASE_DIV     NUMERIC(3,0)  NOT NULL,
  COURT_ID     CHAR(4)       NOT NULL,
  DELETE_CODE  CHAR(1)       NOT NULL DEFAULT ' ',
  PRIMARY KEY (CASE_DIV)
);
GO
