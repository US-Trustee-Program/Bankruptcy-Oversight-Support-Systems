-- Migration 001: CAMS Downstream Integration Schema
-- Creates CMMAP_CAMS table and CMMAP_ALL view in ACMS_REP_SUB.
--
-- CMMAP_CAMS stores CAMS-sourced case assignments (S1) and trustee appointments (TR).
-- CMMAP_ALL unions CMMAP_CAMS with ACMS CMMAP; CAMS overrides ACMS per (case, APPT_TYPE).
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

PRINT 'Step 2: Creating CMMAP_ALL view...';
GO

:r ../schema/cmmap-all.sql

GO

PRINT 'CMMAP_ALL view created.';
GO

-- Verify
IF OBJECT_ID('dbo.CMMAP_CAMS', 'U') IS NULL
    RAISERROR('ERROR: CMMAP_CAMS table not found', 16, 1);
ELSE
    PRINT 'CMMAP_CAMS verified.';

IF OBJECT_ID('dbo.CMMAP_ALL', 'V') IS NULL
    RAISERROR('ERROR: CMMAP_ALL view not found', 16, 1);
ELSE
    PRINT 'CMMAP_ALL verified.';

GO

PRINT '';
PRINT '========================================';
PRINT 'Migration 001 completed successfully.';
PRINT '========================================';
PRINT '';
PRINT 'Next steps:';
PRINT '1. Deploy downstream Azure Functions (staff-assignment-handler, trustee-appointment-handler)';
PRINT '2. Configure downstream consumers (TUFR, BOBJ) to query CMMAP_ALL instead of CMMAP';
PRINT '';

GO
