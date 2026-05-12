-- Integration Test: CMMAP View Union Logic
-- Tests that CMMAP view correctly unions CAMS and ACMS data
--
-- Prerequisites:
-- 1. Run test/acms-cams-transition/seed/01-seed-acms-replica.sql on acms_replica_test
-- 2. Run test/acms-cams-transition/seed/02-seed-cmmap-staging.sql on cams_downstream_test
-- 3. Run database/migrations/001-initial-schema.sql on cams_downstream_test

USE cams_downstream_test;
GO

PRINT '======================================';
PRINT 'CMMAP View Integration Tests';
PRINT '======================================';
PRINT '';

-- Test 1: ACMS-only case (Chapter 7) should return ACMS data
PRINT 'Test 1: ACMS-only case (081-24-12345) - Should return ACMS trustee';
DECLARE @test1Count INT;
DECLARE @test1ProfCode INT;
DECLARE @test1Group CHAR(2);

SELECT
    @test1Count = COUNT(*),
    @test1ProfCode = PROF_CODE,
    @test1Group = GROUP_DESIGNATOR
FROM CMMAP
WHERE CASE_FULL_ACMS = '081-24-12345';

IF @test1Count = 1 AND @test1ProfCode = 123 AND @test1Group = 'NY'
    PRINT '✓ PASS: Returns ACMS data (Prof NY-00123)';
ELSE
    PRINT '✗ FAIL: Expected 1 row with NY-00123, got ' + CAST(@test1Count AS VARCHAR) + ' rows';
PRINT '';

-- Test 2: ACMS-only Chapter 15 (no CAMS override) should return ACMS data
PRINT 'Test 2: ACMS-only Chapter 15 (081-24-88888) - Should return ACMS attorney';
DECLARE @test2Count INT;
DECLARE @test2ProfCode INT;
DECLARE @test2Group CHAR(2);

SELECT
    @test2Count = COUNT(*),
    @test2ProfCode = PROF_CODE,
    @test2Group = GROUP_DESIGNATOR
FROM CMMAP
WHERE CASE_FULL_ACMS = '081-24-88888';

IF @test2Count = 1 AND @test2ProfCode = 222 AND @test2Group = 'CA'
    PRINT '✓ PASS: Returns ACMS data (Prof CA-00222)';
ELSE
    PRINT '✗ FAIL: Expected 1 row with CA-00222, got ' + CAST(@test2Count AS VARCHAR) + ' rows';
PRINT '';

-- Test 3: CAMS override of ACMS Chapter 15 should return CAMS data
PRINT 'Test 3: CAMS override (081-24-99999) - Should return CAMS attorney, NOT ACMS';
DECLARE @test3Count INT;
DECLARE @test3ProfCode INT;
DECLARE @test3Group CHAR(2);
DECLARE @test3Source VARCHAR(10);

SELECT
    @test3Count = COUNT(*),
    @test3ProfCode = s.PROF_CODE,
    @test3Group = s.GROUP_DESIGNATOR,
    @test3Source = s.SOURCE
FROM CMMAP m
LEFT JOIN CMMAP_STAGING s ON m.CASE_FULL_ACMS = s.CAMS_CASE_ID
WHERE m.CASE_FULL_ACMS = '081-24-99999';

IF @test3Count = 1 AND @test3ProfCode = 99002 AND @test3Group = 'ZZ' AND @test3Source = 'CAMS'
    PRINT '✓ PASS: Returns CAMS data (Prof ZZ-99002), ACMS data excluded';
ELSE
    PRINT '✗ FAIL: Expected 1 row with ZZ-99002 from CAMS, got ' + CAST(@test3Count AS VARCHAR) + ' rows';
PRINT '';

-- Test 4: CAMS-only Chapter 15 (not in ACMS) should return CAMS data
PRINT 'Test 4: CAMS-only case (081-24-77777) - Should return CAMS attorney';
DECLARE @test4Count INT;
DECLARE @test4ProfCode INT;
DECLARE @test4Group CHAR(2);

SELECT
    @test4Count = COUNT(*),
    @test4ProfCode = PROF_CODE,
    @test4Group = GROUP_DESIGNATOR
FROM CMMAP
WHERE CASE_FULL_ACMS = '081-24-77777';

IF @test4Count = 1 AND @test4ProfCode = 99001 AND @test4Group = 'ZZ'
    PRINT '✓ PASS: Returns CAMS data (Prof ZZ-99001)';
ELSE
    PRINT '✗ FAIL: Expected 1 row with ZZ-99001, got ' + CAST(@test4Count AS VARCHAR) + ' rows';
PRINT '';

-- Test 5: Inactive CAMS assignment should still appear in view
PRINT 'Test 5: Inactive CAMS assignment (081-24-66666) - Should return with APPTEE_ACTIVE=N';
DECLARE @test5Count INT;
DECLARE @test5Active CHAR(1);

SELECT
    @test5Count = COUNT(*),
    @test5Active = APPTEE_ACTIVE
FROM CMMAP
WHERE CASE_FULL_ACMS = '081-24-66666';

IF @test5Count = 1 AND @test5Active = 'N'
    PRINT '✓ PASS: Returns inactive CAMS data (APPTEE_ACTIVE=N)';
ELSE
    PRINT '✗ FAIL: Expected 1 row with APPTEE_ACTIVE=N, got ' + CAST(@test5Count AS VARCHAR) + ' rows';
PRINT '';

-- Test 6: Total count should be ACMS rows + CAMS staging rows - overrides
-- ACMS: 6 rows; CAMS staging: 4 rows; Overrides: 2 (99999 S1, 55555 TR) = 8 total
PRINT 'Test 6: Total count - Should have 8 appointments (6 ACMS + 4 CAMS, minus 2 overrides)';
DECLARE @totalCount INT;

SELECT @totalCount = COUNT(*) FROM CMMAP;

IF @totalCount = 8
    PRINT '✓ PASS: Total count correct (' + CAST(@totalCount AS VARCHAR) + ' rows)';
ELSE
    PRINT '✗ FAIL: Expected 8 rows, got ' + CAST(@totalCount AS VARCHAR);
PRINT '';

-- Test 7: Verify no duplicate cases
PRINT 'Test 7: No duplicates - Each case should appear exactly once';
DECLARE @duplicateCount INT;

SELECT @duplicateCount = COUNT(*)
FROM (
    SELECT CASE_FULL_ACMS, APPT_TYPE, COUNT(*) as cnt
    FROM CMMAP
    GROUP BY CASE_FULL_ACMS, APPT_TYPE
    HAVING COUNT(*) > 1
) duplicates;

IF @duplicateCount = 0
    PRINT '✓ PASS: No duplicate case+type combinations found';
ELSE
    PRINT '✗ FAIL: Found ' + CAST(@duplicateCount AS VARCHAR) + ' duplicate case+type combinations';
PRINT '';

-- Test 8: CAMS overrides ACMS TR row (081-24-55555)
PRINT 'Test 8: CAMS TR override (081-24-55555) - Should return CAMS trustee UT-00321, NOT ACMS NY-00123';
DECLARE @test8Count INT;
DECLARE @test8ProfCode INT;
DECLARE @test8Group CHAR(2);

SELECT
    @test8Count = COUNT(*),
    @test8ProfCode = PROF_CODE,
    @test8Group = GROUP_DESIGNATOR
FROM CMMAP
WHERE CASE_FULL_ACMS = '081-24-55555';

IF @test8Count = 1 AND @test8ProfCode = 321 AND @test8Group = 'UT'
    PRINT '✓ PASS: Returns CAMS data (Prof UT-00321), ACMS NY-00123 excluded';
ELSE
    PRINT '✗ FAIL: Expected 1 row with UT-00321 from CAMS, got ' + CAST(@test8Count AS VARCHAR) + ' rows (Group=' + ISNULL(@test8Group, 'NULL') + ', Prof=' + CAST(ISNULL(@test8ProfCode, 0) AS VARCHAR) + ')';
PRINT '';

-- Summary
PRINT '======================================';
PRINT 'Test Results Summary';
PRINT '======================================';
SELECT
    CASE_FULL_ACMS,
    PROF_CODE,
    GROUP_DESIGNATOR,
    APPT_TYPE,
    APPTEE_ACTIVE,
    CASE
        WHEN CASE_FULL_ACMS IN ('081-24-77777', '081-24-99999', '081-24-66666', '081-24-55555') THEN 'CAMS'
        ELSE 'ACMS'
    END AS Expected_Source
FROM CMMAP
ORDER BY CASE_FULL_ACMS;
GO
