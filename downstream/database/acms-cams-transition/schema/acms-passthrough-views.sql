-- ACMS Pass-through Views
-- These views provide read-only access to ACMS replica tables without modification
-- BOBJ queries these views instead of ACMS tables directly
--
-- Purpose: Allows downstream systems to switch connection string to point to
-- this database while maintaining same query patterns
--
-- NOTE: Assumes ACMS replica database exists on same SQL Server instance
-- Update database name below if different from 'ACMS_REPLICA'

-- Core Case Management Tables
CREATE VIEW CMMBA AS SELECT * FROM ACMS_REPLICA.dbo.CMMBA; -- Bankruptcy Master
GO
CREATE VIEW CMMDB AS SELECT * FROM ACMS_REPLICA.dbo.CMMDB; -- Debtor Master
GO
CREATE VIEW CMMDBQE AS SELECT * FROM ACMS_REPLICA.dbo.CMMDBQE; -- Debtor Queue
GO
CREATE VIEW CMMPR AS SELECT * FROM ACMS_REPLICA.dbo.CMMPR; -- Professional Master
GO
CREATE VIEW CMMPT AS SELECT * FROM ACMS_REPLICA.dbo.CMMPT; -- Professional Types
GO
CREATE VIEW CMMPD AS SELECT * FROM ACMS_REPLICA.dbo.CMMPD; -- Professional Detail
GO

-- Note: CMMAP is NOT a pass-through - it's the hybrid view defined in cmmap-view.sql

-- Case Details and History
CREATE VIEW CMMCD AS SELECT * FROM ACMS_REPLICA.dbo.CMMCD; -- Case Detail
GO
CREATE VIEW CMMDI AS SELECT * FROM ACMS_REPLICA.dbo.CMMDI; -- Case Discharge
GO
CREATE VIEW CMMDO AS SELECT * FROM ACMS_REPLICA.dbo.CMMDO; -- Case Docket
GO
CREATE VIEW CMMFE AS SELECT * FROM ACMS_REPLICA.dbo.CMMFE; -- Case Fees
GO
CREATE VIEW CMMBL AS SELECT * FROM ACMS_REPLICA.dbo.CMMBL; -- Case Balances
GO

-- Hearing and Calendar Tables
CREATE VIEW CMHHR AS SELECT * FROM ACMS_REPLICA.dbo.CMHHR; -- Hearing Records
GO
CREATE VIEW CMHMR AS SELECT * FROM ACMS_REPLICA.dbo.CMHMR; -- Hearing Master
GO
CREATE VIEW CMHNO AS SELECT * FROM ACMS_REPLICA.dbo.CMHNO; -- Hearing Notes
GO
CREATE VIEW CMHOR AS SELECT * FROM ACMS_REPLICA.dbo.CMHOR; -- Hearing Orders
GO
CREATE VIEW CMHPC AS SELECT * FROM ACMS_REPLICA.dbo.CMHPC; -- Hearing Procedures
GO
CREATE VIEW CMHPL AS SELECT * FROM ACMS_REPLICA.dbo.CMHPL; -- Hearing Plan
GO
CREATE VIEW CMHRP AS SELECT * FROM ACMS_REPLICA.dbo.CMHRP; -- Hearing Reports
GO
CREATE VIEW CMHSS AS SELECT * FROM ACMS_REPLICA.dbo.CMHSS; -- Hearing Summary Statistics
GO

-- Location and Reference Tables
CREATE VIEW CMLOC AS SELECT * FROM ACMS_REPLICA.dbo.CMLOC; -- Locations
GO
CREATE VIEW CMMGD AS SELECT * FROM ACMS_REPLICA.dbo.CMMGD; -- Group Designators
GO
CREATE VIEW CMMRG AS SELECT * FROM ACMS_REPLICA.dbo.CMMRG; -- Regions
GO
CREATE VIEW CMMLC AS SELECT * FROM ACMS_REPLICA.dbo.CMMLC; -- Location Codes
GO
CREATE VIEW CMMKE AS SELECT * FROM ACMS_REPLICA.dbo.CMMKE; -- Key Codes
GO

-- Summary and Statistical Tables
CREATE VIEW CMSSUM AS SELECT * FROM ACMS_REPLICA.dbo.CMSSUM; -- Case Summary
GO
CREATE VIEW CMSSPR AS SELECT * FROM ACMS_REPLICA.dbo.CMSSPR; -- Summary Professional
GO
CREATE VIEW CMSSD AS SELECT * FROM ACMS_REPLICA.dbo.CMSSD; -- Summary Detail
GO
CREATE VIEW CMSSBO AS SELECT * FROM ACMS_REPLICA.dbo.CMSSBO; -- Summary BOBJ
GO

-- Administrative and Miscellaneous Tables
CREATE VIEW CMMAL AS SELECT * FROM ACMS_REPLICA.dbo.CMMAL; -- Mailing Lists
GO
CREATE VIEW CMMER AS SELECT * FROM ACMS_REPLICA.dbo.CMMER; -- Error Logs
GO
CREATE VIEW CMMSD AS SELECT * FROM ACMS_REPLICA.dbo.CMMSD; -- System Dates
GO
CREATE VIEW CMMSH AS SELECT * FROM ACMS_REPLICA.dbo.CMMSH; -- System History
GO
CREATE VIEW CMMWD AS SELECT * FROM ACMS_REPLICA.dbo.CMMWD; -- Workdays
GO
CREATE VIEW USRMSTCDB AS SELECT * FROM ACMS_REPLICA.dbo.USRMSTCDB; -- User Master
GO

-- Reports and Operations Tables (ORO/RPT/TOT prefixes)
CREATE VIEW ORO11TX AS SELECT * FROM ACMS_REPLICA.dbo.ORO11TX; -- Chapter 11 Transactions
GO
CREATE VIEW ORO7CM AS SELECT * FROM ACMS_REPLICA.dbo.ORO7CM; -- Chapter 7 Case Master
GO
CREATE VIEW ORO7CMT AS SELECT * FROM ACMS_REPLICA.dbo.ORO7CMT; -- Chapter 7 Case Master Temp
GO
CREATE VIEW ORO7TR AS SELECT * FROM ACMS_REPLICA.dbo.ORO7TR; -- Chapter 7 Trustee
GO
CREATE VIEW ORO7TRT AS SELECT * FROM ACMS_REPLICA.dbo.ORO7TRT; -- Chapter 7 Trustee Temp
GO
CREATE VIEW OROGD AS SELECT * FROM ACMS_REPLICA.dbo.OROGD; -- Operations Group Designator
GO
CREATE VIEW ORORG AS SELECT * FROM ACMS_REPLICA.dbo.ORORG; -- Operations Region
GO
CREATE VIEW OROSVPJ AS SELECT * FROM ACMS_REPLICA.dbo.OROSVPJ; -- Operations Subchapter V Projects
GO
CREATE VIEW OROSVTX AS SELECT * FROM ACMS_REPLICA.dbo.OROSVTX; -- Operations Subchapter V Transactions
GO
CREATE VIEW OROSVUN AS SELECT * FROM ACMS_REPLICA.dbo.OROSVUN; -- Operations Subchapter V Unit
GO
CREATE VIEW OROYRS AS SELECT * FROM ACMS_REPLICA.dbo.OROYRS; -- Operations Years
GO
CREATE VIEW ORSCODE AS SELECT * FROM ACMS_REPLICA.dbo.ORSCODE; -- Operations Status Codes
GO
CREATE VIEW ORSCOD2 AS SELECT * FROM ACMS_REPLICA.dbo.ORSCOD2; -- Operations Status Codes 2
GO

-- Report Tables
CREATE VIEW RPT11PJ AS SELECT * FROM ACMS_REPLICA.dbo.RPT11PJ; -- Report Chapter 11 Projects
GO
CREATE VIEW RPT11TX AS SELECT * FROM ACMS_REPLICA.dbo.RPT11TX; -- Report Chapter 11 Transactions
GO
CREATE VIEW RPT11UN AS SELECT * FROM ACMS_REPLICA.dbo.RPT11UN; -- Report Chapter 11 Units
GO
CREATE VIEW RPTSVPJ AS SELECT * FROM ACMS_REPLICA.dbo.RPTSVPJ; -- Report Subchapter V Projects
GO
CREATE VIEW RPTSVTX AS SELECT * FROM ACMS_REPLICA.dbo.RPTSVTX; -- Report Subchapter V Transactions
GO
CREATE VIEW RPTSVUN AS SELECT * FROM ACMS_REPLICA.dbo.RPTSVUN; -- Report Subchapter V Units
GO

-- Total/Summary Tables
CREATE VIEW TOT11PJ AS SELECT * FROM ACMS_REPLICA.dbo.TOT11PJ; -- Total Chapter 11 Projects
GO
CREATE VIEW TOT11UN AS SELECT * FROM ACMS_REPLICA.dbo.TOT11UN; -- Total Chapter 11 Units
GO
CREATE VIEW TOTSVPJ AS SELECT * FROM ACMS_REPLICA.dbo.TOTSVPJ; -- Total Subchapter V Projects
GO
CREATE VIEW TOTSVUN AS SELECT * FROM ACMS_REPLICA.dbo.TOTSVUN; -- Total Subchapter V Units
GO

-- Metadata and System Tables
-- Note: MSpeer_* tables and sysdiagrams are typically system tables - include only if needed
-- CREATE VIEW MSpeer_lsns AS SELECT * FROM ACMS_REPLICA.dbo.MSpeer_lsns;
-- CREATE VIEW MSpeer_originatorid_history AS SELECT * FROM ACMS_REPLICA.dbo.MSpeer_originatorid_history;
-- CREATE VIEW sysdiagrams AS SELECT * FROM ACMS_REPLICA.dbo.sysdiagrams;

GO

-- Extended properties for documentation
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Pass-through view to ACMS Bankruptcy Master', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'VIEW', @level1name = N'CMMBA';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Pass-through view to ACMS Debtor Master', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'VIEW', @level1name = N'CMMDB';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Pass-through view to ACMS Professional Master', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'VIEW', @level1name = N'CMMPR';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Pass-through view to ACMS Professional Types', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'VIEW', @level1name = N'CMMPT';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Pass-through view to ACMS Professional Detail', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'VIEW', @level1name = N'CMMPD';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Pass-through view to ACMS Case Summary', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'VIEW', @level1name = N'CMSSUM';
GO

PRINT 'Created ' + CAST(@@ROWCOUNT AS VARCHAR) + ' pass-through views';
GO
