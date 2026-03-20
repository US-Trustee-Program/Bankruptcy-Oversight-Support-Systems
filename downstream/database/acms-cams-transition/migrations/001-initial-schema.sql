-- Migration 001: Initial Schema for CAMS Downstream Integration
-- Creates staging table, views for Chapter 15 assignment integration
--
-- Prerequisites:
-- 1. Database 'cams-downstream' exists on Azure SQL Server
-- 2. ACMS replica database exists on same server (for cross-database queries)
-- 3. Appropriate permissions granted for cross-database queries
--
-- Run this migration ONCE to set up the initial schema

-- Step 1: Create staging table for CAMS assignments
PRINT 'Creating CMMAP_STAGING table...';
GO

:r ../schema/cmmap-staging.sql

GO

PRINT 'CMMAP_STAGING table created successfully.';
GO

-- Step 2: Create CMMAP union view
PRINT 'Creating CMMAP view...';
GO

:r ../schema/cmmap-view.sql

GO

PRINT 'CMMAP view created successfully.';
GO

-- Step 3: Create pass-through views for ACMS tables
PRINT 'Creating ACMS pass-through views...';
GO

:r ../schema/acms-passthrough-views.sql

GO

PRINT 'ACMS pass-through views created successfully.';
GO

-- Step 4: Verify schema
PRINT 'Verifying schema...';
GO

-- Check that staging table exists
IF OBJECT_ID('dbo.CMMAP_STAGING', 'U') IS NULL
    RAISERROR('ERROR: CMMAP_STAGING table not found', 16, 1);
ELSE
    PRINT 'CMMAP_STAGING table verified.';

-- Check that CMMAP view exists
IF OBJECT_ID('dbo.CMMAP', 'V') IS NULL
    RAISERROR('ERROR: CMMAP view not found', 16, 1);
ELSE
    PRINT 'CMMAP view verified.';

-- Check that pass-through views exist
IF OBJECT_ID('dbo.CMMPR', 'V') IS NULL
    RAISERROR('ERROR: CMMPR pass-through view not found', 16, 1);
ELSE
    PRINT 'CMMPR pass-through view verified.';

GO

PRINT '';
PRINT '========================================';
PRINT 'Migration 001 completed successfully!';
PRINT '========================================';
PRINT '';
PRINT 'Next steps:';
PRINT '1. Deploy Azure Function to process Chapter 15 assignment events';
PRINT '2. Configure BOBJ to connect to this database instead of ACMS replica';
PRINT '3. Test CMMAP view returns expected results';
PRINT '';

GO
