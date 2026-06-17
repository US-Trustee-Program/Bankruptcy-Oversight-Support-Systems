-- Migration 001: CAMS Downstream Integration Schema
-- Creates CMMAP_CAMS, CMMAP_ALL, and CMMAP_SYNC_CONTROL in ACMS_REP_SUB.
--
-- CMMAP_CAMS stores CAMS-sourced case assignments (S1) and trustee appointments (TR).
-- CMMAP_ALL is the unified authoritative appointment table for downstream consumers.
--   - Seeded from CMMAP at cutover (see Step 4 below)
--   - Kept current by two write paths:
--       a. Daily timer trigger (ACMS→CMMAP_ALL, SOURCE='ACMS')
--       b. CAMS event handler (CMMAP_CAMS + CMMAP_ALL in one transaction, SOURCE='CAMS')
-- CMMAP_SYNC_CONTROL tracks the watermark for the daily ACMS sync.
--
-- Prerequisites:
--   ACMS_REP_SUB database exists with dbo.CMMAP (native ACMS appointments)
--
-- Run this migration ONCE per environment.

PRINT 'Migration 001: CAMS Downstream Integration Schema';
GO

PRINT 'Step 1: Creating CMMAP_CAMS table...';
GO

:r ../schema/cmmap-cams.sql

GO

PRINT 'CMMAP_CAMS table created.';
GO

PRINT 'Step 2: Creating CMMAP_ALL table...';
GO

:r ../schema/cmmap-all.sql

GO

PRINT 'CMMAP_ALL table created.';
GO

PRINT 'Step 3: Creating CMMAP_SYNC_CONTROL table...';
GO

:r ../schema/cmmap-sync-control.sql

GO

PRINT 'CMMAP_SYNC_CONTROL table created and seeded.';
GO

PRINT 'Step 4: Seeding CMMAP_ALL from CMMAP (active + immediate predecessor rows)...';
GO

-- Seed active appointments and their immediate predecessors from CMMAP.
-- "Immediate predecessor" = the highest RECORD_SEQ_NBR row per (case, APPT_TYPE)
-- that is NOT the active row. We include it so CMMAP_ALL reflects the full
-- transition context when CAMS takes over a case.
INSERT INTO CMMAP_ALL (
    DELETE_CODE,
    CASE_DIV, CASE_YEAR, CASE_NUMBER, RECORD_SEQ_NBR,
    APPT_TYPE,
    PROF_CODE, GROUP_DESIGNATOR,
    APPT_DATE, APPT_DATE_DT,
    APPT_DISP, DISP_DATE, DISP_DATE_DT,
    COMMENTS, APPTEE_ACTIVE, ALPHA_SEARCH, USER_ID,
    HEARING_SEQUENCE, REGION_CODE,
    RGN_CREATE_DATE, RGN_UPDATE_DATE, RGN_CREATE_DATE_DT, RGN_UPDATE_DATE_DT,
    CDB_CREATE_DATE, CDB_UPDATE_DATE, CDB_CREATE_DATE_DT, CDB_UPDATE_DATE_DT,
    UPDATE_DATE, REPLICATED_DATE, id, RRN,
    SOURCE, LAST_UPDATED
)
SELECT
    m.DELETE_CODE,
    m.CASE_DIV, m.CASE_YEAR, m.CASE_NUMBER, m.RECORD_SEQ_NBR,
    m.APPT_TYPE,
    m.PROF_CODE, m.GROUP_DESIGNATOR,
    m.APPT_DATE, m.APPT_DATE_DT,
    m.APPT_DISP, m.DISP_DATE, m.DISP_DATE_DT,
    m.COMMENTS, m.APPTEE_ACTIVE, m.ALPHA_SEARCH, m.USER_ID,
    m.HEARING_SEQUENCE, m.REGION_CODE,
    m.RGN_CREATE_DATE, m.RGN_UPDATE_DATE, m.RGN_CREATE_DATE_DT, m.RGN_UPDATE_DATE_DT,
    m.CDB_CREATE_DATE, m.CDB_UPDATE_DATE, m.CDB_CREATE_DATE_DT, m.CDB_UPDATE_DATE_DT,
    m.UPDATE_DATE, m.REPLICATED_DATE, m.id, m.RRN,
    'ACMS', GETDATE()
FROM dbo.CMMAP m
WHERE
    -- Active appointments
    m.APPTEE_ACTIVE = 'Y'
    AND m.DELETE_CODE = ' '

UNION ALL

-- Immediate predecessor per (case, APPT_TYPE): highest RECORD_SEQ_NBR that is not active
SELECT
    m.DELETE_CODE,
    m.CASE_DIV, m.CASE_YEAR, m.CASE_NUMBER, m.RECORD_SEQ_NBR,
    m.APPT_TYPE,
    m.PROF_CODE, m.GROUP_DESIGNATOR,
    m.APPT_DATE, m.APPT_DATE_DT,
    m.APPT_DISP, m.DISP_DATE, m.DISP_DATE_DT,
    m.COMMENTS, m.APPTEE_ACTIVE, m.ALPHA_SEARCH, m.USER_ID,
    m.HEARING_SEQUENCE, m.REGION_CODE,
    m.RGN_CREATE_DATE, m.RGN_UPDATE_DATE, m.RGN_CREATE_DATE_DT, m.RGN_UPDATE_DATE_DT,
    m.CDB_CREATE_DATE, m.CDB_UPDATE_DATE, m.CDB_CREATE_DATE_DT, m.CDB_UPDATE_DATE_DT,
    m.UPDATE_DATE, m.REPLICATED_DATE, m.id, m.RRN,
    'ACMS', GETDATE()
FROM dbo.CMMAP m
INNER JOIN (
    SELECT
        CASE_DIV, CASE_YEAR, CASE_NUMBER, APPT_TYPE,
        MAX(RECORD_SEQ_NBR) AS MAX_SEQ
    FROM dbo.CMMAP
    WHERE APPTEE_ACTIVE = 'N' AND DELETE_CODE = ' '
    GROUP BY CASE_DIV, CASE_YEAR, CASE_NUMBER, APPT_TYPE
) pred ON m.CASE_DIV    = pred.CASE_DIV
       AND m.CASE_YEAR   = pred.CASE_YEAR
       AND m.CASE_NUMBER = pred.CASE_NUMBER
       AND m.APPT_TYPE   = pred.APPT_TYPE
       AND m.RECORD_SEQ_NBR = pred.MAX_SEQ
-- Exclude if this case+type already has an active row (already included above)
WHERE EXISTS (
    SELECT 1 FROM dbo.CMMAP active
    WHERE active.CASE_DIV    = m.CASE_DIV
      AND active.CASE_YEAR   = m.CASE_YEAR
      AND active.CASE_NUMBER = m.CASE_NUMBER
      AND active.APPT_TYPE   = m.APPT_TYPE
      AND active.APPTEE_ACTIVE = 'Y'
      AND active.DELETE_CODE = ' '
);

GO

PRINT 'CMMAP_ALL seeded from CMMAP.';
GO

-- Update watermark to now so the daily sync only picks up changes after cutover
UPDATE CMMAP_SYNC_CONTROL
SET LAST_SYNC_DATE = GETDATE(), LAST_RUN_AT = GETDATE()
WHERE PROCESS_NAME = 'ACMS_DAILY';

GO

-- Verify
IF OBJECT_ID('dbo.CMMAP_CAMS', 'U') IS NULL
    RAISERROR('ERROR: CMMAP_CAMS table not found', 16, 1);
ELSE
    PRINT 'CMMAP_CAMS verified.';

IF OBJECT_ID('dbo.CMMAP_ALL', 'U') IS NULL
    RAISERROR('ERROR: CMMAP_ALL table not found', 16, 1);
ELSE
    PRINT 'CMMAP_ALL verified.';

IF OBJECT_ID('dbo.CMMAP_SYNC_CONTROL', 'U') IS NULL
    RAISERROR('ERROR: CMMAP_SYNC_CONTROL table not found', 16, 1);
ELSE
    PRINT 'CMMAP_SYNC_CONTROL verified.';

GO

PRINT '';
PRINT '========================================';
PRINT 'Migration 001 completed successfully.';
PRINT '========================================';
PRINT '';
PRINT 'Next steps:';
PRINT '1. Deploy downstream Azure Functions (staff-assignment-handler, trustee-appointment-handler, acms-daily-sync)';
PRINT '2. Configure downstream consumers (TUFR, BOBJ) to query CMMAP_ALL instead of CMMAP';
PRINT '';

GO
