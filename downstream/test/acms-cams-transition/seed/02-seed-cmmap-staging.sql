-- Seed CMMAP_STAGING with Mock CAMS Data
-- Run this on the cams_downstream_test database
--
-- Seeds Chapter 15 assignments from CAMS to override ACMS data

USE cams_downstream_test;
GO

-- Clear existing staging data
DELETE FROM CMMAP_STAGING;
GO

-- Case 1: NEW Chapter 15 assignment (not in ACMS)
INSERT INTO CMMAP_STAGING (
    DELETE_CODE,
    CASE_DIV, CASE_YEAR, CASE_NUMBER, RECORD_SEQ_NBR,
    PROF_CODE, GROUP_DESIGNATOR,
    APPT_TYPE,
    APPT_DATE, APPT_DATE_DT,
    APPTEE_ACTIVE,
    ALPHA_SEARCH,
    USER_ID,
    CDB_CREATE_DATE, CDB_UPDATE_DATE,
    CDB_CREATE_DATE_DT, CDB_UPDATE_DATE_DT,
    UPDATE_DATE,
    SOURCE,
    CAMS_CASE_ID,
    CAMS_USER_ID,
    CAMS_USER_NAME,
    LAST_UPDATED
) VALUES (
    ' ',
    081, 24, 77777, 1,
    99001, 'ZZ',  -- CAMS placeholder professional ID
    'S1',
    20241101, '2024-11-01',
    'Y',
    'GARCIA',
    'CAMS',
    20241101, 20241101,
    '2024-11-01', '2024-11-01',
    GETDATE(),
    'CAMS',
    '081-24-77777',
    'user-12345',
    'Maria Garcia',
    GETDATE()
);
GO

-- Case 2: OVERRIDE existing ACMS Chapter 15 assignment (case 081-24-99999)
-- ACMS has Williams (NY-00111), CAMS has different attorney
INSERT INTO CMMAP_STAGING (
    DELETE_CODE,
    CASE_DIV, CASE_YEAR, CASE_NUMBER, RECORD_SEQ_NBR,
    PROF_CODE, GROUP_DESIGNATOR,
    APPT_TYPE,
    APPT_DATE, APPT_DATE_DT,
    APPTEE_ACTIVE,
    ALPHA_SEARCH,
    USER_ID,
    CDB_CREATE_DATE, CDB_UPDATE_DATE,
    CDB_CREATE_DATE_DT, CDB_UPDATE_DATE_DT,
    UPDATE_DATE,
    SOURCE,
    CAMS_CASE_ID,
    CAMS_USER_ID,
    CAMS_USER_NAME,
    LAST_UPDATED
) VALUES (
    ' ',
    081, 24, 99999, 1,
    99002, 'ZZ',  -- CAMS placeholder professional ID
    'S1',
    20241115, '2024-11-15',
    'Y',
    'RODRIGUEZ',
    'CAMS',
    20241115, 20241115,
    '2024-11-15', '2024-11-15',
    GETDATE(),
    'CAMS',
    '081-24-99999',
    'user-67890',
    'Carlos Rodriguez',
    GETDATE()
);
GO

-- Case 3: Chapter 15 assignment that was UNASSIGNED
INSERT INTO CMMAP_STAGING (
    DELETE_CODE,
    CASE_DIV, CASE_YEAR, CASE_NUMBER, RECORD_SEQ_NBR,
    PROF_CODE, GROUP_DESIGNATOR,
    APPT_TYPE,
    APPT_DATE, APPT_DATE_DT,
    APPT_DISP, DISP_DATE, DISP_DATE_DT,
    APPTEE_ACTIVE,
    ALPHA_SEARCH,
    USER_ID,
    CDB_CREATE_DATE, CDB_UPDATE_DATE,
    CDB_CREATE_DATE_DT, CDB_UPDATE_DATE_DT,
    UPDATE_DATE,
    SOURCE,
    CAMS_CASE_ID,
    CAMS_USER_ID,
    CAMS_USER_NAME,
    LAST_UPDATED
) VALUES (
    ' ',
    081, 24, 66666, 1,
    99003, 'ZZ',
    'S1',
    20241001, '2024-10-01',
    'TR', 20241110, '2024-11-10',  -- Terminated/Removed
    'N',  -- Not active
    'CHEN',
    'CAMS',
    20241001, 20241110,
    '2024-10-01', '2024-11-10',
    GETDATE(),
    'CAMS',
    '081-24-66666',
    'user-11111',
    'Linda Chen',
    GETDATE()
);
GO

PRINT 'CMMAP_STAGING seeded with ' + CAST(@@ROWCOUNT AS VARCHAR) + ' CAMS assignments';
PRINT '';
PRINT 'Test Cases:';
PRINT '  081-24-77777: NEW Chapter 15 from CAMS (not in ACMS)';
PRINT '  081-24-99999: OVERRIDE Chapter 15 (CAMS replaces ACMS data)';
PRINT '  081-24-66666: UNASSIGNED Chapter 15 (inactive)';
PRINT '';
PRINT 'Expected CMMAP View Results:';
PRINT '  081-24-12345: ACMS data (Ch7)';
PRINT '  081-24-23456: ACMS data (Ch11)';
PRINT '  081-24-34567: ACMS data (Ch13)';
PRINT '  081-24-88888: ACMS data (Ch15, no CAMS override)';
PRINT '  081-24-99999: CAMS data (Ch15, override)';
PRINT '  081-24-77777: CAMS data (Ch15, new)';
PRINT '  081-24-66666: CAMS data (Ch15, inactive)';
GO
