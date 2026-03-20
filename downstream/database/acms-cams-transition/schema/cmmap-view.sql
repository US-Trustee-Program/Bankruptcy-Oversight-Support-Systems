-- CMMAP View: Union of CAMS Chapter 15 assignments and ACMS assignments
-- BOBJ and downstream systems query this view instead of ACMS.dbo.CMMAP directly
--
-- Strategy:
-- 1. Return CAMS Chapter 15 data from CMMAP_STAGING
-- 2. Return all ACMS data where no matching CAMS record exists (by case)
--
-- This allows CAMS to "override" ACMS data for Chapter 15 cases while
-- transparently passing through all other chapter data from ACMS.

CREATE VIEW CMMAP AS

-- CAMS Chapter 15 assignments from staging table
SELECT
    DELETE_CODE,
    CASE_DIV,
    CASE_YEAR,
    CASE_NUMBER,
    RECORD_SEQ_NBR,
    PROF_CODE,
    APPT_TYPE,
    APPT_DATE,
    APPT_DISP,
    DISP_DATE,
    COMMENTS,
    APPTEE_ACTIVE,
    ALPHA_SEARCH,
    USER_ID,
    HEARING_SEQUENCE,
    REGION_CODE,
    GROUP_DESIGNATOR,
    RGN_CREATE_DATE,
    RGN_UPDATE_DATE,
    CDB_CREATE_DATE,
    CDB_UPDATE_DATE,
    APPT_DATE_DT,
    DISP_DATE_DT,
    RGN_CREATE_DATE_DT,
    RGN_UPDATE_DATE_DT,
    CDB_CREATE_DATE_DT,
    CDB_UPDATE_DATE_DT,
    CASE_FULL_ACMS,
    UPDATE_DATE,
    NULL AS REPLICATED_DATE,  -- Not applicable for CAMS data
    NULL AS id,               -- Not applicable for CAMS data
    NULL AS RRN               -- Not applicable for CAMS data
FROM CMMAP_STAGING
WHERE DELETE_CODE = ' '       -- Only active records

UNION ALL

-- ACMS assignments for all cases NOT managed by CAMS
SELECT
    DELETE_CODE,
    CASE_DIV,
    CASE_YEAR,
    CASE_NUMBER,
    RECORD_SEQ_NBR,
    PROF_CODE,
    APPT_TYPE,
    APPT_DATE,
    APPT_DISP,
    DISP_DATE,
    COMMENTS,
    APPTEE_ACTIVE,
    ALPHA_SEARCH,
    USER_ID,
    HEARING_SEQUENCE,
    REGION_CODE,
    GROUP_DESIGNATOR,
    RGN_CREATE_DATE,
    RGN_UPDATE_DATE,
    CDB_CREATE_DATE,
    CDB_UPDATE_DATE,
    APPT_DATE_DT,
    DISP_DATE_DT,
    RGN_CREATE_DATE_DT,
    RGN_UPDATE_DATE_DT,
    CDB_CREATE_DATE_DT,
    CDB_UPDATE_DATE_DT,
    CASE_FULL_ACMS,
    UPDATE_DATE,
    REPLICATED_DATE,
    id,
    RRN
FROM ACMS_REPLICA.dbo.CMMAP AS acms
WHERE NOT EXISTS (
    -- Exclude ACMS records if CAMS has data for this case
    SELECT 1
    FROM CMMAP_STAGING AS cams
    WHERE cams.CASE_DIV = acms.CASE_DIV
      AND cams.CASE_YEAR = acms.CASE_YEAR
      AND cams.CASE_NUMBER = acms.CASE_NUMBER
      AND cams.DELETE_CODE = ' '  -- Only consider active CAMS records
);

GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Union view of CAMS Chapter 15 assignments (from staging) and ACMS assignments (from replica). BOBJ queries this view.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'VIEW',   @level1name = N'CMMAP';

GO

-- Note: The view uses a three-part name (ACMS_REPLICA.dbo.CMMAP) to reference
-- the ACMS database on the same SQL Server instance. This requires:
-- 1. ACMS database exists on same server
-- 2. Appropriate permissions for the downstream database user to query ACMS

-- Alternative if ACMS is on a different server: Use a linked server or synonym
