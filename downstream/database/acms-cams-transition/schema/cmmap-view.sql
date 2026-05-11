-- CMMAP View: Union of CAMS-managed appointments and ACMS appointments
-- Downstream consumers (TUFR, Business Objects) query this view in place of ACMS.dbo.CMMAP
--
-- Strategy:
--   Return CAMS rows from CMMAP_STAGING for appointment types CAMS owns on a given case.
--   Return ACMS rows only where CAMS has no active row for that case + APPT_TYPE combination.
--
-- This means CAMS can own TR rows for a case while ACMS still owns other appointment types
-- on the same case — the exclusion is per (case, APPT_TYPE), not per case.

IF OBJECT_ID('dbo.CMMAP', 'V') IS NOT NULL
    DROP VIEW dbo.CMMAP;

GO

CREATE VIEW CMMAP AS

-- CAMS-managed appointments from staging table
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
    NULL AS REPLICATED_DATE,
    NULL AS id,
    NULL AS RRN
FROM CMMAP_STAGING
WHERE DELETE_CODE = ' '

UNION ALL

-- ACMS appointments where CAMS has no active row for this case + APPT_TYPE
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
    SELECT 1
    FROM CMMAP_STAGING AS cams
    WHERE cams.CASE_DIV    = acms.CASE_DIV
      AND cams.CASE_YEAR   = acms.CASE_YEAR
      AND cams.CASE_NUMBER = acms.CASE_NUMBER
      AND cams.APPT_TYPE   = acms.APPT_TYPE
      AND cams.DELETE_CODE = ' '
);

GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Union view of CAMS appointments (from staging) and ACMS appointments (from replica). CAMS overrides ACMS per case+APPT_TYPE, not per case. TUFR and Business Objects query this view.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'VIEW',   @level1name = N'CMMAP';

GO

-- Note: The view uses a three-part name (ACMS_REPLICA.dbo.CMMAP) to reference
-- the ACMS database on the same SQL Server instance. Requires appropriate
-- permissions for the downstream database user.
