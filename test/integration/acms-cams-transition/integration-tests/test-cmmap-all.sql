-- Integration Test: CMMAP_ALL Table Correctness
-- Tests that CMMAP_ALL contains the correct unified appointment state after seeding.
--
-- Prerequisites:
-- 1. Run seed/01-seed-acms-replica.sql (creates CMMAP, CMMPR, CMMPT)
-- 2. Run schema/cmmap-cams.sql (creates CMMAP_CAMS)
-- 3. Run schema/cmmap-all.sql (creates CMMAP_ALL table)
-- 4. Run schema/cmmap-sync-control.sql (creates CMMAP_SYNC_CONTROL)
-- 5. Run seed/02-seed-cmmap-all.sql (seeds CMMAP_ALL + CMMAP_CAMS from ACMS data + CAMS overrides)
--
-- Run via harness:
--   npm run acms-cams-transition -- run-sql \
--     test/integration/acms-cams-transition/integration-tests/test-cmmap-all.sql ACMS_REP_SUB

PRINT '======================================';
PRINT 'CMMAP_ALL Table Integration Tests';
PRINT '======================================';
PRINT '';

-- Test 1: ACMS-only case (Chapter 7) returns ACMS data with SOURCE='ACMS'
PRINT 'Test 1: ACMS-only case (081-24-12345) - Should return SOURCE=ACMS trustee';
DECLARE @test1Count INT;
DECLARE @test1ProfCode INT;
DECLARE @test1Source VARCHAR(10);

SELECT
    @test1Count = COUNT(*),
    @test1ProfCode = MAX(PROF_CODE),
    @test1Source = MAX(SOURCE)
FROM CMMAP_ALL
WHERE CASE_FULL_ACMS = '081-24-12345';

IF @test1Count = 1 AND @test1ProfCode = 123 AND @test1Source = 'ACMS'
    PRINT '✓ PASS: Returns ACMS data (Prof 123, SOURCE=ACMS)';
ELSE
    PRINT '✗ FAIL: Expected 1 row with Prof=123 SOURCE=ACMS, got ' + CAST(@test1Count AS VARCHAR) + ' rows (Prof=' + CAST(ISNULL(@test1ProfCode,0) AS VARCHAR) + ', SOURCE=' + ISNULL(@test1Source,'NULL') + ')';
PRINT '';

-- Test 2: ACMS-only Chapter 15 (no CAMS override) returns ACMS data
PRINT 'Test 2: ACMS-only Ch15 (081-24-88888) - Should return SOURCE=ACMS attorney';
DECLARE @test2Count INT;
DECLARE @test2ProfCode INT;
DECLARE @test2Source VARCHAR(10);

SELECT
    @test2Count = COUNT(*),
    @test2ProfCode = MAX(PROF_CODE),
    @test2Source = MAX(SOURCE)
FROM CMMAP_ALL
WHERE CASE_FULL_ACMS = '081-24-88888';

IF @test2Count = 1 AND @test2ProfCode = 222 AND @test2Source = 'ACMS'
    PRINT '✓ PASS: Returns ACMS data (Prof 222, SOURCE=ACMS)';
ELSE
    PRINT '✗ FAIL: Expected 1 row with Prof=222 SOURCE=ACMS, got ' + CAST(@test2Count AS VARCHAR) + ' rows';
PRINT '';

-- Test 3: CAMS override of ACMS Ch15 returns CAMS data with SOURCE='CAMS'
PRINT 'Test 3: CAMS override (081-24-99999) - Should return SOURCE=CAMS, NOT ACMS prof';
DECLARE @test3Count INT;
DECLARE @test3ProfCode INT;
DECLARE @test3Source VARCHAR(10);

SELECT
    @test3Count = COUNT(*),
    @test3ProfCode = MAX(PROF_CODE),
    @test3Source = MAX(SOURCE)
FROM CMMAP_ALL
WHERE CASE_FULL_ACMS = '081-24-99999';

IF @test3Count = 1 AND @test3ProfCode = 88 AND @test3Source = 'CAMS'
    PRINT '✓ PASS: Returns CAMS data (Prof 88, SOURCE=CAMS), ACMS Prof 111 excluded';
ELSE
    PRINT '✗ FAIL: Expected 1 row with Prof=88 SOURCE=CAMS, got ' + CAST(@test3Count AS VARCHAR) + ' rows (Prof=' + CAST(ISNULL(@test3ProfCode,0) AS VARCHAR) + ', SOURCE=' + ISNULL(@test3Source,'NULL') + ')';
PRINT '';

-- Test 4: CAMS-only case (not in ACMS) returns CAMS data
PRINT 'Test 4: CAMS-only case (081-24-77777) - Should return SOURCE=CAMS attorney';
DECLARE @test4Count INT;
DECLARE @test4ProfCode INT;
DECLARE @test4Source VARCHAR(10);

SELECT
    @test4Count = COUNT(*),
    @test4ProfCode = MAX(PROF_CODE),
    @test4Source = MAX(SOURCE)
FROM CMMAP_ALL
WHERE CASE_FULL_ACMS = '081-24-77777';

IF @test4Count = 1 AND @test4ProfCode = 63 AND @test4Source = 'CAMS'
    PRINT '✓ PASS: Returns CAMS data (Prof 63, SOURCE=CAMS)';
ELSE
    PRINT '✗ FAIL: Expected 1 row with Prof=63 SOURCE=CAMS, got ' + CAST(@test4Count AS VARCHAR) + ' rows';
PRINT '';

-- Test 5: Inactive CAMS assignment appears with APPTEE_ACTIVE='N'
PRINT 'Test 5: Inactive CAMS assignment (081-24-66666) - Should return APPTEE_ACTIVE=N';
DECLARE @test5Count INT;
DECLARE @test5Active CHAR(1);

SELECT
    @test5Count = COUNT(*),
    @test5Active = MAX(APPTEE_ACTIVE)
FROM CMMAP_ALL
WHERE CASE_FULL_ACMS = '081-24-66666';

IF @test5Count = 1 AND @test5Active = 'N'
    PRINT '✓ PASS: Returns inactive CAMS data (APPTEE_ACTIVE=N)';
ELSE
    PRINT '✗ FAIL: Expected 1 row with APPTEE_ACTIVE=N, got ' + CAST(@test5Count AS VARCHAR) + ' rows';
PRINT '';

-- Test 6: Total row count — 5 ACMS + 4 CAMS − 2 overrides = 7 rows
PRINT 'Test 6: Total count - Should have 7 appointments';
DECLARE @totalCount INT;
SELECT @totalCount = COUNT(*) FROM CMMAP_ALL;

IF @totalCount = 7
    PRINT '✓ PASS: Total count correct (' + CAST(@totalCount AS VARCHAR) + ' rows)';
ELSE
    PRINT '✗ FAIL: Expected 7 rows, got ' + CAST(@totalCount AS VARCHAR);
PRINT '';

-- Test 7: No duplicate (case, APPT_TYPE) combinations
PRINT 'Test 7: No duplicates - Each case+APPT_TYPE combination appears exactly once';
DECLARE @duplicateCount INT;

SELECT @duplicateCount = COUNT(*)
FROM (
    SELECT CASE_FULL_ACMS, APPT_TYPE, COUNT(*) AS cnt
    FROM CMMAP_ALL
    GROUP BY CASE_FULL_ACMS, APPT_TYPE
    HAVING COUNT(*) > 1
) duplicates;

IF @duplicateCount = 0
    PRINT '✓ PASS: No duplicate case+type combinations found';
ELSE
    PRINT '✗ FAIL: Found ' + CAST(@duplicateCount AS VARCHAR) + ' duplicate case+type combinations';
PRINT '';

-- Test 8: CAMS TR override (081-24-55555) — CAMS wins over ACMS trustee
PRINT 'Test 8: CAMS TR override (081-24-55555) - Should return CAMS trustee UT-00321';
DECLARE @test8Count INT;
DECLARE @test8ProfCode INT;
DECLARE @test8Group CHAR(2);
DECLARE @test8Source VARCHAR(10);

SELECT
    @test8Count = COUNT(*),
    @test8ProfCode = MAX(PROF_CODE),
    @test8Group = MAX(GROUP_DESIGNATOR),
    @test8Source = MAX(SOURCE)
FROM CMMAP_ALL
WHERE CASE_FULL_ACMS = '081-24-55555';

IF @test8Count = 1 AND @test8ProfCode = 321 AND @test8Group = 'UT' AND @test8Source = 'CAMS'
    PRINT '✓ PASS: Returns CAMS data (Prof UT-00321, SOURCE=CAMS), ACMS NY-00123 excluded';
ELSE
    PRINT '✗ FAIL: Expected 1 row UT-00321 SOURCE=CAMS, got ' + CAST(@test8Count AS VARCHAR) + ' rows (Group=' + ISNULL(@test8Group,'NULL') + ', Prof=' + CAST(ISNULL(@test8ProfCode,0) AS VARCHAR) + ', SOURCE=' + ISNULL(@test8Source,'NULL') + ')';
PRINT '';

-- Test 9: CMMAP_SYNC_CONTROL has ACMS_DAILY row
PRINT 'Test 9: CMMAP_SYNC_CONTROL - Should have ACMS_DAILY control row';
DECLARE @ctrlCount INT;
SELECT @ctrlCount = COUNT(*) FROM CMMAP_SYNC_CONTROL WHERE PROCESS_NAME = 'ACMS_DAILY';

IF @ctrlCount = 1
    PRINT '✓ PASS: ACMS_DAILY control row exists';
ELSE
    PRINT '✗ FAIL: Expected 1 ACMS_DAILY row in CMMAP_SYNC_CONTROL, got ' + CAST(@ctrlCount AS VARCHAR);
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
    SOURCE
FROM CMMAP_ALL
ORDER BY CASE_FULL_ACMS;
GO
