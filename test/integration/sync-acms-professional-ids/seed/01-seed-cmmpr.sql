-- Seed ACMS CMMPR/CMMAP/CMMDB fixture rows for sync-acms-professional-ids
-- integration tests. Every row is GROUP_DESIGNATOR='NY' except one 'UT' row
-- used to prove the harness correctly pages/tracks bookmarks per group.
--
-- CMMPR rows (all PROF_TYPE='TR'):
--   UST_PROF_CODE 63:  fingerprint match  — demographics equal the
--                      TRUSTEE_VARIATION fixture seeded in Cosmos for
--                      INTEGRATION-TRUSTEE-FINGERPRINT
--   UST_PROF_CODE 64:  name match         — unique name matching CAMS
--                      trustee INTEGRATION-TRUSTEE-NAME, no fingerprint on file
--   UST_PROF_CODE 65:  no-match, active   — name matches nothing in CAMS, but
--                      has an active CMMAP appointment -> verification expected
--   UST_PROF_CODE 66:  no-match, inactive — name matches nothing in CAMS and
--                      has NO active CMMAP appointment -> silently skipped
--   UST_PROF_CODE 70:  (GROUP_DESIGNATOR='UT') second group, name match again,
--                      proves handleStart queues one page message per group
--   UST_PROF_CODE 71:  fingerprint match, leading-zero zip — PROF_ZIP 65110000 (New Haven, CT;
--                      the real 065110000 value with its leading zero already dropped by
--                      NUMERIC(9,0) storage) proves formatAcmsZip zero-pads to 9 digits before
--                      splitting 5+4 ("06511-0000"), not just re-dashing a value assumed to
--                      already be 9 digits wide
--
-- Run against ACMS_INT database after seed-schema has been applied.

TRUNCATE TABLE dbo.CMMPR;
GO

TRUNCATE TABLE dbo.CMMAP;
GO

TRUNCATE TABLE dbo.CMMDB;
GO

-- ── CMMPR rows ───────────────────────────────────────────────────────────────

-- Record 1: fingerprint match (NY-00063)
INSERT INTO dbo.CMMPR
  (GROUP_DESIGNATOR, UST_PROF_CODE, DELETE_CODE, PROF_TYPE, PROF_LAST_NAME, PROF_FIRST_NAME, PROF_MI,
   PROF_ADDRESS1, PROF_ADDRESS2, PROF_CITY, PROF_STATE, PROF_ZIP, PROF_FAX_NBR, PROF_COMMERCIAL_PHONE_NBR)
VALUES
  ('NY', 63, ' ', 'TR', 'Fingerprint', 'Iris', 'F',
   '500 Match Ln', '', 'Springfield', 'IL', 627010000, 0, 2175550100);
GO

-- Record 2: name match (NY-00064) — unique name, no fingerprint variant on file
INSERT INTO dbo.CMMPR
  (GROUP_DESIGNATOR, UST_PROF_CODE, DELETE_CODE, PROF_TYPE, PROF_LAST_NAME, PROF_FIRST_NAME, PROF_MI,
   PROF_ADDRESS1, PROF_ADDRESS2, PROF_CITY, PROF_STATE, PROF_ZIP, PROF_FAX_NBR, PROF_COMMERCIAL_PHONE_NBR)
VALUES
  ('NY', 64, ' ', 'TR', 'Namematch', 'Norman', 'N',
   '600 Unique Ave', '', 'Albany', 'NY', 122070000, 0, 5185550200);
GO

-- Record 3: no-match, has an active CMMAP appointment -> verification expected
INSERT INTO dbo.CMMPR
  (GROUP_DESIGNATOR, UST_PROF_CODE, DELETE_CODE, PROF_TYPE, PROF_LAST_NAME, PROF_FIRST_NAME, PROF_MI,
   PROF_ADDRESS1, PROF_ADDRESS2, PROF_CITY, PROF_STATE, PROF_ZIP, PROF_FAX_NBR, PROF_COMMERCIAL_PHONE_NBR)
VALUES
  ('NY', 65, ' ', 'TR', 'Activenomatch', 'Amanda', 'A',
   '700 Nobody Knows St', '', 'Buffalo', 'NY', 142020000, 0, 7165550300);
GO

-- Record 4: no-match, zero active CMMAP appointments -> silently skipped
INSERT INTO dbo.CMMPR
  (GROUP_DESIGNATOR, UST_PROF_CODE, DELETE_CODE, PROF_TYPE, PROF_LAST_NAME, PROF_FIRST_NAME, PROF_MI,
   PROF_ADDRESS1, PROF_ADDRESS2, PROF_CITY, PROF_STATE, PROF_ZIP, PROF_FAX_NBR, PROF_COMMERCIAL_PHONE_NBR)
VALUES
  ('NY', 66, ' ', 'TR', 'Inactivenomatch', 'Ignatius', 'I',
   '800 Nowhere Rd', '', 'Rochester', 'NY', 146040000, 0, 5855550400);
GO

-- Record 5: second group (UT) — proves per-group paging/bookmarking. Name
-- matches CAMS trustee INTEGRATION-TRUSTEE-UT.
INSERT INTO dbo.CMMPR
  (GROUP_DESIGNATOR, UST_PROF_CODE, DELETE_CODE, PROF_TYPE, PROF_LAST_NAME, PROF_FIRST_NAME, PROF_MI,
   PROF_ADDRESS1, PROF_ADDRESS2, PROF_CITY, PROF_STATE, PROF_ZIP, PROF_FAX_NBR, PROF_COMMERCIAL_PHONE_NBR)
VALUES
  ('UT', 70, ' ', 'TR', 'Utahmatch', 'Ulysses', 'U',
   '900 Beehive Blvd', '', 'Salt Lake City', 'UT', 841110000, 0, 8015550500);
GO

-- Record 5b: fingerprint match, leading-zero zip (NY-00071). PROF_ZIP 65110000 is the real
-- 065110000 (New Haven, CT) with its leading zero already dropped by NUMERIC(9,0) storage —
-- proves buildAcmsVariant's formatAcmsZip zero-pads to 9 digits before splitting 5+4.
INSERT INTO dbo.CMMPR
  (GROUP_DESIGNATOR, UST_PROF_CODE, DELETE_CODE, PROF_TYPE, PROF_LAST_NAME, PROF_FIRST_NAME, PROF_MI,
   PROF_ADDRESS1, PROF_ADDRESS2, PROF_CITY, PROF_STATE, PROF_ZIP, PROF_FAX_NBR, PROF_COMMERCIAL_PHONE_NBR)
VALUES
  ('NY', 71, ' ', 'TR', 'Leadingzero', 'Lena', 'L',
   '400 Elm St', '', 'New Haven', 'CT', 65110000, 0, 2035550800);
GO

-- Record 6: soft-deleted — must NOT be paged (DELETE_CODE='D')
INSERT INTO dbo.CMMPR
  (GROUP_DESIGNATOR, UST_PROF_CODE, DELETE_CODE, PROF_TYPE, PROF_LAST_NAME, PROF_FIRST_NAME, PROF_MI,
   PROF_ADDRESS1, PROF_ADDRESS2, PROF_CITY, PROF_STATE, PROF_ZIP, PROF_FAX_NBR, PROF_COMMERCIAL_PHONE_NBR)
VALUES
  ('NY', 67, 'D', 'TR', 'Deleted', 'Delia', 'D',
   '999 Gone St', '', 'Yonkers', 'NY', 107010000, 0, 9145550600);
GO

-- Record 7: non-trustee professional type — must NOT be paged (PROF_TYPE != 'TR')
INSERT INTO dbo.CMMPR
  (GROUP_DESIGNATOR, UST_PROF_CODE, DELETE_CODE, PROF_TYPE, PROF_LAST_NAME, PROF_FIRST_NAME, PROF_MI,
   PROF_ADDRESS1, PROF_ADDRESS2, PROF_CITY, PROF_STATE, PROF_ZIP, PROF_FAX_NBR, PROF_COMMERCIAL_PHONE_NBR)
VALUES
  ('NY', 68, ' ', 'AT', 'Attorney', 'Alan', 'A',
   '1000 Legal Way', '', 'Syracuse', 'NY', 132020000, 0, 3155550700);
GO

PRINT 'CMMPR seeded: 8 rows (6 TR/active + 1 deleted + 1 non-TR filtered)';
GO

-- ── CMMDB rows (one per case referenced by CMMAP below) ─────────────────────

INSERT INTO dbo.CMMDB (CASE_DIV, CASE_YEAR, CASE_NUMBER, CURR_CASE_CHAPT)
VALUES (81, 24, 50001, '7 ');
GO

-- ── CMMAP rows (active-appointment gate fixtures) ───────────────────────────

-- UST_PROF_CODE 65 has one active (undisposed) appointment -> gate passes
INSERT INTO dbo.CMMAP
  (RECORD_SEQ_NBR, CASE_DIV, CASE_YEAR, CASE_NUMBER, GROUP_DESIGNATOR, PROF_CODE, APPT_DATE, DISP_DATE, DELETE_CODE, APPTEE_ACTIVE, APPT_TYPE)
VALUES
  (1, 81, 24, 50001, 'NY', 65, 20230101, 0, ' ', 'Y', 'TR');
GO

PRINT 'CMMAP seeded: 1 row (active appointment for UST_PROF_CODE 65)';
PRINT 'CMMDB seeded: 1 row';
GO
