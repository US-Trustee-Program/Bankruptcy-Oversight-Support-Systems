-- Seed CMMAP_CAMS with mock CAMS data
--
-- Seeds Ch15 staff attorney assignments (APPT_TYPE='S1') and
-- trustee appointments (APPT_TYPE='TR')

DELETE FROM CMMAP_CAMS;
GO

-- Case 081-24-77777: New Ch15 staff assignment (not in ACMS)
INSERT INTO CMMAP_CAMS (
    DELETE_CODE,
    CASE_DIV, CASE_YEAR, CASE_NUMBER, RECORD_SEQ_NBR,
    PROF_CODE, GROUP_DESIGNATOR,
    APPT_TYPE,
    APPT_DATE, APPT_DATE_DT,
    APPT_DISP,
    APPTEE_ACTIVE,
    ALPHA_SEARCH,
    USER_ID,
    CDB_CREATE_DATE, CDB_UPDATE_DATE,
    CDB_CREATE_DATE_DT, CDB_UPDATE_DATE_DT,
    UPDATE_DATE,
    SOURCE,
    CAMS_CASE_ID, CAMS_USER_ID, CAMS_USER_NAME,
    LAST_UPDATED
) VALUES (
    ' ',
    081, 24, 77777, 1,
    63, 'NY',
    'S1',
    20241101, '2024-11-01',
    'AP',
    'Y',
    'GARCIA',
    'CAMS',
    20241101, 20241101,
    '2024-11-01', '2024-11-01',
    GETDATE(),
    'CAMS',
    '081-24-77777', 'user-12345', 'Maria Garcia',
    GETDATE()
);
GO

-- Case 081-24-99999: Ch15 staff assignment overriding ACMS record
INSERT INTO CMMAP_CAMS (
    DELETE_CODE,
    CASE_DIV, CASE_YEAR, CASE_NUMBER, RECORD_SEQ_NBR,
    PROF_CODE, GROUP_DESIGNATOR,
    APPT_TYPE,
    APPT_DATE, APPT_DATE_DT,
    APPT_DISP,
    APPTEE_ACTIVE,
    ALPHA_SEARCH,
    USER_ID,
    CDB_CREATE_DATE, CDB_UPDATE_DATE,
    CDB_CREATE_DATE_DT, CDB_UPDATE_DATE_DT,
    UPDATE_DATE,
    SOURCE,
    CAMS_CASE_ID, CAMS_USER_ID, CAMS_USER_NAME,
    LAST_UPDATED
) VALUES (
    ' ',
    081, 24, 99999, 1,
    88, 'NY',
    'S1',
    20241115, '2024-11-15',
    'AP',
    'Y',
    'RODRIGUEZ',
    'CAMS',
    20241115, 20241115,
    '2024-11-15', '2024-11-15',
    GETDATE(),
    'CAMS',
    '081-24-99999', 'user-67890', 'Carlos Rodriguez',
    GETDATE()
);
GO

-- Case 081-24-66666: Ch15 staff assignment that was unassigned (APPT_DISP='WD')
INSERT INTO CMMAP_CAMS (
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
    CAMS_CASE_ID, CAMS_USER_ID, CAMS_USER_NAME,
    LAST_UPDATED
) VALUES (
    ' ',
    081, 24, 66666, 1,
    42, 'NY',
    'S1',
    20241001, '2024-10-01',
    'WD', 20241110, '2024-11-10',
    'N',
    'CHEN',
    'CAMS',
    20241001, 20241110,
    '2024-10-01', '2024-11-10',
    GETDATE(),
    'CAMS',
    '081-24-66666', 'user-11111', 'Linda Chen',
    GETDATE()
);
GO

-- Case 081-24-55555: Trustee appointment (APPT_TYPE='TR'), active
-- Demonstrates S1 and TR rows coexisting in the same staging table
INSERT INTO CMMAP_CAMS (
    DELETE_CODE,
    CASE_DIV, CASE_YEAR, CASE_NUMBER, RECORD_SEQ_NBR,
    PROF_CODE, GROUP_DESIGNATOR,
    APPT_TYPE,
    APPT_DATE, APPT_DATE_DT,
    APPT_DISP,
    APPTEE_ACTIVE,
    ALPHA_SEARCH,
    USER_ID,
    CDB_CREATE_DATE, CDB_UPDATE_DATE,
    CDB_CREATE_DATE_DT, CDB_UPDATE_DATE_DT,
    UPDATE_DATE,
    SOURCE,
    CAMS_CASE_ID, CAMS_USER_ID, CAMS_USER_NAME,
    LAST_UPDATED
) VALUES (
    ' ',
    081, 24, 55555, 1,
    321, 'UT',
    'TR',
    20240901, '2024-09-01',
    'GR',
    'Y',
    'BARR',
    'CAMS',
    20240901, 20240901,
    '2024-09-01', '2024-09-01',
    GETDATE(),
    'CAMS',
    '081-24-55555', 'trustee-99999', 'Harvey Barr',
    GETDATE()
);
GO

PRINT 'CMMAP_CAMS seeded successfully.';
PRINT '';
PRINT 'Test cases:';
PRINT '  081-24-77777 S1: New Ch15 staff assignment (not in ACMS)';
PRINT '  081-24-99999 S1: Ch15 staff override of ACMS record';
PRINT '  081-24-66666 S1: Unassigned Ch15 staff (APPT_DISP=WD, inactive)';
PRINT '  081-24-55555 TR: Trustee appointment (APPT_DISP=GR, active)';
PRINT '';
PRINT 'Expected CMMAP_ALL view: ACMS rows pass through except where';
PRINT '  CAMS has an active row for that (case, APPT_TYPE) combination.';
GO
