-- Migration 002: CAMS-616 Trustee Appointment Downstream Support
-- Adds APPT_TYPE to CMMAP_STAGING primary key to support both
-- S1 (staff attorney) and TR (trustee) rows per case.
-- Updates CMMAP view to exclude ACMS rows per (case, APPT_TYPE) rather than per case.
--
-- Prerequisites:
--   Migration 001 applied
--   No existing rows in CMMAP_STAGING (staging table only, no production data)
--
-- Run this migration ONCE in each environment before deploying CAMS-616.

PRINT 'Migration 002: CAMS-616 Trustee Appointment Downstream Support';
GO

-- Step 1: Drop and recreate CMMAP_STAGING with updated primary key
PRINT 'Recreating CMMAP_STAGING with APPT_TYPE in primary key...';
GO

:r ../schema/cmmap-staging.sql

GO

PRINT 'CMMAP_STAGING recreated successfully.';
GO

-- Step 2: Replace CMMAP view with APPT_TYPE-aware exclusion logic
PRINT 'Replacing CMMAP view...';
GO

:r ../schema/cmmap-view.sql

GO

PRINT 'CMMAP view replaced successfully.';
GO

-- Step 3: Verify schema
IF OBJECT_ID('dbo.CMMAP_STAGING', 'U') IS NULL
    RAISERROR('ERROR: CMMAP_STAGING table not found', 16, 1);
ELSE
    PRINT 'CMMAP_STAGING verified.';

IF OBJECT_ID('dbo.CMMAP', 'V') IS NULL
    RAISERROR('ERROR: CMMAP view not found', 16, 1);
ELSE
    PRINT 'CMMAP view verified.';

GO

PRINT '';
PRINT '========================================';
PRINT 'Migration 002 completed successfully.';
PRINT '========================================';
PRINT '';
PRINT 'Next steps:';
PRINT '1. Deploy CAMS-616 Azure Function (trustee-appointment-handler)';
PRINT '2. Verify CMMAP view returns TR rows for trustee appointments';
PRINT '3. Verify S1 rows and TR rows for same case coexist correctly';
PRINT '';

GO
