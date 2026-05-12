-- CMMAP_TRANSITION View: Union of CAMS-managed appointments and ACMS appointments
-- Lives in ACMS_REP_SUB alongside the existing CMMAP table and CMMAP_STAGING.
--
-- Strategy:
--   Return CAMS rows from CMMAP_STAGING for appointment types CAMS owns on a given case.
--   Return ACMS rows only where CAMS has no active row for that case + APPT_TYPE combination.
--
-- This means CAMS can own TR rows for a case while ACMS still owns other appointment types
-- on the same case — the exclusion is per (case, APPT_TYPE), not per case.

IF OBJECT_ID('dbo.CMMAP_TRANSITION', 'V') IS NOT NULL
    DROP VIEW dbo.CMMAP_TRANSITION;

GO

CREATE VIEW CMMAP_TRANSITION AS

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
FROM dbo.CMMAP AS acms
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
    @value = N'Union view of CAMS appointments (from CMMAP_STAGING) and ACMS appointments (from CMMAP). CAMS overrides ACMS per case+APPT_TYPE. Lives in ACMS_REP_SUB alongside CMMAP and CMMAP_STAGING.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'VIEW',   @level1name = N'CMMAP_TRANSITION';

GO
