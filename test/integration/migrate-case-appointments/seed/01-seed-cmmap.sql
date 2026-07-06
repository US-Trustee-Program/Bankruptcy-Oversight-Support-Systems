-- Seed ACMS CMMAP and CMMDB fixture rows for migrate-case-appointments integration tests.
--
-- CMMAP rows:
--   Record 1: active trustee appointment, open case            → INCLUDED
--   Record 2: closed trustee appointment (has disposition),
--             open case                                        → INCLUDED
--   Record 3: deleted (DELETE_CODE='D')                        → filtered by DELETE_CODE
--   Record 4: non-trustee appointment (APPT_TYPE='AT')         → filtered by APPT_TYPE
--   Record 5: trustee appointment on a case closed before
--             the 8-year cutoff (20180101)                     → filtered by case age JOIN
--
-- Run against ACMS_INT database after seed-schema has been applied.

TRUNCATE TABLE dbo.CMMAP;
GO

TRUNCATE TABLE dbo.CMMDB;
GO

TRUNCATE TABLE dbo.CMMKE;
GO

-- ── CMMDB rows (one per unique case) ────────────────────────────────────────

-- Case 081-24-12345: still open
INSERT INTO dbo.CMMDB (CASE_DIV, CASE_YEAR, CASE_NUMBER, CLOSED_BY_COURT_DATE, CLOSED_BY_UST_DATE, CASE_FILED_DATE, CURR_CASE_CHAPT)
VALUES (81, 24, 12345, 0, 0, 20190110, '7 ');
GO

-- Case 081-24-67890: still open (appointment has a disposition date but the case is still open)
INSERT INTO dbo.CMMDB (CASE_DIV, CASE_YEAR, CASE_NUMBER, CLOSED_BY_COURT_DATE, CLOSED_BY_UST_DATE, CASE_FILED_DATE, CURR_CASE_CHAPT)
VALUES (81, 24, 67890, 0, 0, 20180520, '13');
GO

-- Case 081-23-99999: still open (filtered by DELETE_CODE before reaching age check)
INSERT INTO dbo.CMMDB (CASE_DIV, CASE_YEAR, CASE_NUMBER, CLOSED_BY_COURT_DATE, CLOSED_BY_UST_DATE, CASE_FILED_DATE, CURR_CASE_CHAPT)
VALUES (81, 23, 99999, 0, 0, 20170601, '7 ');
GO

-- Case 081-22-11111: non-trustee appointment case, still open
INSERT INTO dbo.CMMDB (CASE_DIV, CASE_YEAR, CASE_NUMBER, CLOSED_BY_COURT_DATE, CLOSED_BY_UST_DATE, CASE_FILED_DATE, CURR_CASE_CHAPT)
VALUES (81, 22, 11111, 0, 0, 20200301, '11');
GO

-- Case 081-15-55555: closed before the 8-year cutoff → must be filtered out
INSERT INTO dbo.CMMDB (CASE_DIV, CASE_YEAR, CASE_NUMBER, CLOSED_BY_COURT_DATE, CLOSED_BY_UST_DATE, CASE_FILED_DATE, CURR_CASE_CHAPT)
VALUES (81, 15, 55555, 20150601, 0, 20140101, '7 ');
GO

-- Case 081-21-77777: deleted case (DELETE_CODE='D') → must be filtered out
INSERT INTO dbo.CMMDB (CASE_DIV, CASE_YEAR, CASE_NUMBER, CLOSED_BY_COURT_DATE, CLOSED_BY_UST_DATE, DELETE_CODE, CASE_FILED_DATE, CURR_CASE_CHAPT)
VALUES (81, 21, 77777, 0, 0, 'D', 20200101, '7 ');
GO

-- ── CMMAP rows ───────────────────────────────────────────────────────────────

-- Record 1: active trustee appointment, open case
--   Maps to: caseId='081-24-12345', acmsProfessionalId='NY-00063'
--            assignedOn='2020-01-15', no unassignedOn
INSERT INTO dbo.CMMAP
  (RECORD_SEQ_NBR, CASE_DIV, CASE_YEAR, CASE_NUMBER, GROUP_DESIGNATOR, PROF_CODE, APPT_DATE, DISP_DATE, DELETE_CODE, APPTEE_ACTIVE, APPT_TYPE)
VALUES
  (1, 81, 24, 12345, 'NY', 63, 20200115, 0, ' ', 'Y', 'TR');
GO

-- Record 2: closed trustee appointment (disposition date set), open case
--   Maps to: caseId='081-24-67890', acmsProfessionalId='NY-00063'
--            assignedOn='2019-03-01', unassignedOn='2021-06-30'
INSERT INTO dbo.CMMAP
  (RECORD_SEQ_NBR, CASE_DIV, CASE_YEAR, CASE_NUMBER, GROUP_DESIGNATOR, PROF_CODE, APPT_DATE, DISP_DATE, DELETE_CODE, APPTEE_ACTIVE, APPT_TYPE)
VALUES
  (2, 81, 24, 67890, 'NY', 63, 20190301, 20210630, ' ', 'Y', 'TR');
GO

-- Record 3: deleted — must NOT appear (DELETE_CODE='D')
INSERT INTO dbo.CMMAP
  (RECORD_SEQ_NBR, CASE_DIV, CASE_YEAR, CASE_NUMBER, GROUP_DESIGNATOR, PROF_CODE, APPT_DATE, DISP_DATE, DELETE_CODE, APPTEE_ACTIVE, APPT_TYPE)
VALUES
  (3, 81, 23, 99999, 'NY', 63, 20180101, 0, 'D', 'Y', 'TR');
GO

-- Record 4: non-trustee appointment (APPT_TYPE='AT') — must NOT appear
INSERT INTO dbo.CMMAP
  (RECORD_SEQ_NBR, CASE_DIV, CASE_YEAR, CASE_NUMBER, GROUP_DESIGNATOR, PROF_CODE, APPT_DATE, DISP_DATE, DELETE_CODE, APPTEE_ACTIVE, APPT_TYPE)
VALUES
  (4, 81, 22, 11111, 'NY', 63, 20210301, 0, ' ', 'Y', 'AT');
GO

-- Record 5: trustee appointment but case closed before 20180101 — must NOT appear (age filter)
INSERT INTO dbo.CMMAP
  (RECORD_SEQ_NBR, CASE_DIV, CASE_YEAR, CASE_NUMBER, GROUP_DESIGNATOR, PROF_CODE, APPT_DATE, DISP_DATE, DELETE_CODE, APPTEE_ACTIVE, APPT_TYPE)
VALUES
  (5, 81, 15, 55555, 'NY', 63, 20150401, 0, ' ', 'Y', 'TR');
GO

-- Record 6: trustee appointment on a deleted case — must NOT appear (CMMDB DELETE_CODE='D')
INSERT INTO dbo.CMMAP
  (RECORD_SEQ_NBR, CASE_DIV, CASE_YEAR, CASE_NUMBER, GROUP_DESIGNATOR, PROF_CODE, APPT_DATE, DISP_DATE, DELETE_CODE, APPTEE_ACTIVE, APPT_TYPE)
VALUES
  (6, 81, 21, 77777, 'NY', 63, 20210601, 0, ' ', 'Y', 'TR');
GO

PRINT 'CMMAP seeded: 6 rows (2 included, 4 filtered: deleted appt / wrong type / too old / deleted case)';
PRINT 'CMMDB seeded: 6 rows (one per unique case, with CASE_FILED_DATE and CURR_CASE_CHAPT)';
GO

-- ── CMMKE rows (Key Events — reopening events) ──────────────────────────────

-- Case 081-24-12345 was reopened once on 2022-03-15
INSERT INTO dbo.CMMKE (CASE_DIV, CASE_YEAR, CASE_NUMBER, EVENT_CODE_TYPE, EVENT_CODE, GROUP_DESIGNATOR, ORIGINAL_OCC_DATE)
VALUES (81, 24, 12345, 'O', 'OCO', 'NY', 20220315);
GO

PRINT 'CMMKE seeded: 1 row (reopening event for 081-24-12345)';
GO
