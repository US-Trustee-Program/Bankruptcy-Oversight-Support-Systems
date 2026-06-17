-- Seed ACMS CMMAP fixture rows for migrate-case-appointments integration tests.
--
-- Inserts 3 fixture records (idempotent — truncates before inserting):
--   Record 1: active appointment, no disposition   → should appear in results
--   Record 2: closed appointment (has disposition) → should appear in results
--   Record 3: deleted (DELETE_CODE='D')            → must be filtered out
--
-- Run against ACMS_INT database after seed-schema has been applied.

-- Truncate for idempotency
TRUNCATE TABLE dbo.CMMAP;
GO

-- Record 1: active appointment, no disposition
--   Maps to: caseId='081-24-12345', acmsProfessionalId='NY-00063'
--            assignDate=20200115, no unassignDate
INSERT INTO dbo.CMMAP
  (RECORD_SEQ_NBR, CASE_DIV, CASE_YEAR, CASE_NUMBER, GROUP_DESIGNATOR, PROF_CODE, APPT_DATE, DISP_DATE, DELETE_CODE, APPTEE_ACTIVE)
VALUES
  (1, 81, 24, 12345, 'NY', 63, 20200115, 0, ' ', 'Y');
GO

-- Record 2: closed appointment (has disposition)
--   Maps to: caseId='081-24-67890', acmsProfessionalId='NY-00063'
--            assignDate=20190301, unassignDate=20210630
INSERT INTO dbo.CMMAP
  (RECORD_SEQ_NBR, CASE_DIV, CASE_YEAR, CASE_NUMBER, GROUP_DESIGNATOR, PROF_CODE, APPT_DATE, DISP_DATE, DELETE_CODE, APPTEE_ACTIVE)
VALUES
  (2, 81, 24, 67890, 'NY', 63, 20190301, 20210630, ' ', 'Y');
GO

-- Record 3: deleted — must NOT appear in results (DELETE_CODE='D' filters it)
INSERT INTO dbo.CMMAP
  (RECORD_SEQ_NBR, CASE_DIV, CASE_YEAR, CASE_NUMBER, GROUP_DESIGNATOR, PROF_CODE, APPT_DATE, DISP_DATE, DELETE_CODE, APPTEE_ACTIVE)
VALUES
  (3, 81, 23, 99999, 'NY', 63, 20180101, 0, 'D', 'Y');
GO

PRINT 'CMMAP seeded: 3 rows (2 active/closed, 1 deleted)';
GO
