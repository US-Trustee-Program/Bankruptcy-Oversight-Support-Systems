-- ACMS fixture rows for the 6 backfill-trustee-professional-ids records across 5 scenarios (see
-- README.md's coverage table). Drop-and-recreate by reserved key blocks so this file is fully
-- idempotent.
--
-- Reserved namespace:
--   GROUP_DESIGNATOR = 'BT'            (all CMMPR/CMMAP rows in this harness)
--   UST_PROF_CODE / PROF_CODE          97001-97006 (one per record; 97001/97002 = scenario 1a/1b)
--   CASE_DIV                           601-604 (records 97001/97002/97005), 701-711 (record 97003)
--
-- Matching CAMS-side (Mongo) trustee/appointment fixtures are seeded by the harness script
-- (scripts/backfill-trustee-professional-ids-harness.ts's seedCosmos()), not here -- SQL only
-- covers the ACMS half.

-- ---------------------------------------------------------------------------
-- Cleanup (idempotent)
-- ---------------------------------------------------------------------------

DELETE FROM dbo.CMMAP WHERE GROUP_DESIGNATOR = 'BT';
GO
DELETE FROM dbo.CMMDB WHERE CASE_DIV IN (601, 602, 603, 604, 701, 702, 703, 704, 705, 706, 707, 708, 709, 710, 711);
GO
DELETE FROM dbo.CMMPR WHERE GROUP_DESIGNATOR = 'BT';
GO
DELETE FROM dbo.CMMDO WHERE CASE_DIV IN (601, 602, 603, 604, 701, 702, 703, 704, 705, 706, 707, 708, 709, 710, 711);
GO

-- ---------------------------------------------------------------------------
-- CMMDO — division/office map. Scenario 2 (gap-check) needs 11 distinct courts to reach a
-- genuine 9-of-10 overlap-coefficient fraction (90); scenarios 1a/1b/4 need one/two courts each.
-- ---------------------------------------------------------------------------

INSERT INTO dbo.CMMDO (CASE_DIV, COURT_ID, DELETE_CODE) VALUES
  (601, 'BT01', ' '),  -- scenario 1a
  (602, 'BT02', ' '),  -- scenario 1b
  (603, 'BT03', ' '),  -- scenario 4, appointment A
  (604, 'BT04', ' '),  -- scenario 4, appointment B
  (701, 'S301', ' '),  -- scenario 2, court 1 of 10 (shared by ACMS + winner + runner-up)
  (702, 'S302', ' '),  -- scenario 2, court 2 of 10
  (703, 'S303', ' '),  -- scenario 2, court 3 of 10
  (704, 'S304', ' '),  -- scenario 2, court 4 of 10
  (705, 'S305', ' '),  -- scenario 2, court 5 of 10
  (706, 'S306', ' '),  -- scenario 2, court 6 of 10
  (707, 'S307', ' '),  -- scenario 2, court 7 of 10
  (708, 'S308', ' '),  -- scenario 2, court 8 of 10
  (709, 'S309', ' '),  -- scenario 2, court 9 of 10
  (710, 'S310', ' '),  -- scenario 2, court 10 of 10 (ACMS + winner only, NOT in runner-up's set)
  (711, 'S311', ' ');  -- scenario 2, runner-up's 10th court (NOT in ACMS's set)
GO

-- ---------------------------------------------------------------------------
-- CMMPR — one professional per scenario, PROF_TYPE = 'TR'.
-- ---------------------------------------------------------------------------

INSERT INTO dbo.CMMPR
  (DELETE_CODE, GROUP_DESIGNATOR, UST_PROF_CODE, PROF_FIRST_NAME, PROF_LAST_NAME, PROF_MI,
   PROF_ADDRESS1, PROF_ADDRESS2, PROF_CITY, PROF_STATE, PROF_ZIP, PROF_COMMERCIAL_PHONE_NBR,
   PROF_TYPE, UPDATE_DATE)
VALUES
  -- Scenario 1a: phonetic-search match with full corroboration.
  (' ', 'BT', 97001, 'Robert', 'Ashworth-Quintela', NULL,
   '100 Ashworth Ln', NULL, 'Springfield', 'IL', 62701, 2175550001,
   'TR', GETDATE()),

  -- Scenario 1b: a second, independent phonetic-search match with full corroboration. PROF_STATE
  -- is deliberately stale/wrong ('ZZ' vs. the CAMS trustee's real 'NM') -- incidental fixture
  -- variety, not a distinct code path, since state plays no role in candidate selection or scoring.
  (' ', 'BT', 97002, 'Jonathan', 'Villareal', NULL,
   '200 Villareal Ave', NULL, 'Santa Fe', 'ZZ', 87501, 5055550002,
   'TR', GETDATE()),

  -- Scenario 2: multi-candidate gap-check. Two CAMS trustees share this exact name+state; both
  -- clear the auto-match threshold individually, but the gap between them is < 5.
  (' ', 'BT', 97003, 'Delphine', 'Okonkwo-Reyes', NULL,
   '300 Okonkwo Way', NULL, 'Seattle', 'WA', 98101, 2065550003,
   'TR', GETDATE()),

  -- Scenario 3: lone candidate below threshold. Name matches exactly (so a candidate is found via
  -- phonetic search), but address/phone/appointment-history corroboration is absent or mismatched,
  -- landing the lone candidate's total score under the auto-match threshold.
  (' ', 'BT', 97004, 'Simone', 'Okafor', NULL,
   '400 Okafor Rd', NULL, 'Chicago', 'IL', 60601, NULL,
   'TR', GETDATE()),

  -- Scenario 4 (THE most important regression case): every CMMAP appointment row for this
  -- professional is a closed, pre-2018 case (see the CMMAP insert below). Proves the open-case
  -- filter was genuinely dropped from getCmmapAppointmentsForProfessionalIds, not just removed
  -- from the SQL text — these rows must still populate the district/chapter sets and produce a
  -- full-confidence match against the (currently active) CAMS trustee.
  (' ', 'BT', 97005, 'Harriet', 'Kowalski', NULL,
   '500 Kowalski Blvd', NULL, 'Columbus', 'OH', 43085, 6145550005,
   'TR', GETDATE()),

  -- Scenario 5: already-mapped idempotency. A trustee-professional-ids mapping for this ACMS
  -- id is pre-seeded by the harness before processAcmsProfessionalRecordsPage runs; this record
  -- must be skipped (counted as alreadyMapped) without being scored or re-written.
  (' ', 'BT', 97006, 'Otis', 'Vance', NULL,
   '600 Vance Ct', NULL, 'Pittsburgh', 'PA', 15201, 4125550006,
   'TR', GETDATE());
GO

-- ---------------------------------------------------------------------------
-- CMMDB — case rows joined by CMMAP. CLOSED_BY_COURT_DATE/CLOSED_BY_UST_DATE are 0 (open)
-- except scenario 4's two rows, which are deliberately closed pre-2018.
-- ---------------------------------------------------------------------------

INSERT INTO dbo.CMMDB
  (CASE_DIV, CASE_YEAR, CASE_NUMBER, CLOSED_BY_COURT_DATE, CLOSED_BY_UST_DATE, DELETE_CODE, CASE_FILED_DATE, CURR_CASE_CHAPT)
VALUES
  -- Scenario 1a: one open case, chapter 7.
  (601, 24, 10001, 0, 0, ' ', 20240115, '7'),

  -- Scenario 1b: one open case, chapter 11.
  (602, 24, 10002, 0, 0, ' ', 20240201, '11'),

  -- Scenario 4: TWO closed, pre-2018 cases -- the regression-proof rows. Both closed dates are
  -- real pre-2018 dates, not the "0 = open" sentinel.
  (603, 15, 10005, 20150615, 20150620, ' ', 20150101, '7'),
  (604, 16, 10006, 20160910, 20160915, ' ', 20160201, '13'),

  -- Scenario 5: one open case, chapter 7 (own case row -- distinct from scenario 1a's, which
  -- shares CASE_DIV 601 but must not share the same (CASE_DIV, CASE_YEAR, CASE_NUMBER) key).
  (601, 24, 10007, 0, 0, ' ', 20240115, '7'),

  -- Scenario 2: ten open cases across ten distinct courts (S301..S310), all chapter 7.
  (701, 24, 10301, 0, 0, ' ', 20240301, '7'),
  (702, 24, 10302, 0, 0, ' ', 20240301, '7'),
  (703, 24, 10303, 0, 0, ' ', 20240301, '7'),
  (704, 24, 10304, 0, 0, ' ', 20240301, '7'),
  (705, 24, 10305, 0, 0, ' ', 20240301, '7'),
  (706, 24, 10306, 0, 0, ' ', 20240301, '7'),
  (707, 24, 10307, 0, 0, ' ', 20240301, '7'),
  (708, 24, 10308, 0, 0, ' ', 20240301, '7'),
  (709, 24, 10309, 0, 0, ' ', 20240301, '7'),
  (710, 24, 10310, 0, 0, ' ', 20240301, '7');
GO

-- ---------------------------------------------------------------------------
-- CMMAP — one row per case above, APPT_TYPE = 'TR', DELETE_CODE = ' ' (not deleted).
-- Scenario 3 deliberately has ZERO CMMAP rows (no appointment history at all).
-- Scenario 5 gets one row for realism, though it's never fetched (its professional id is
-- filtered out as alreadyMapped before the batched appointment query runs).
-- ---------------------------------------------------------------------------

INSERT INTO dbo.CMMAP
  (RECORD_SEQ_NBR, CASE_DIV, CASE_YEAR, CASE_NUMBER, GROUP_DESIGNATOR, PROF_CODE, APPT_DATE, DISP_DATE, DELETE_CODE, APPTEE_ACTIVE, APPT_TYPE)
VALUES
  -- Scenario 1a: BT-97001 appointed in court BT01 / chapter 7.
  (1, 601, 24, 10001, 'BT', 97001, 20240115, 0, ' ', 'Y', 'TR'),

  -- Scenario 1b: BT-97002 appointed in court BT02 / chapter 11.
  (1, 602, 24, 10002, 'BT', 97002, 20240201, 0, ' ', 'Y', 'TR'),

  -- Scenario 4: BT-97005 appointed in BOTH closed pre-2018 cases (courts BT03/BT04).
  (1, 603, 15, 10005, 'BT', 97005, 20150101, 20150615, ' ', 'Y', 'TR'),
  (1, 604, 16, 10006, 'BT', 97005, 20160201, 20160910, ' ', 'Y', 'TR'),

  -- Scenario 5: BT-97006 appointed once, for realism only (never fetched — see comment above).
  (1, 601, 24, 10007, 'BT', 97006, 20240115, 0, ' ', 'Y', 'TR'),

  -- Scenario 2: BT-97003 appointed once in EACH of the ten S301..S310 courts (10 CMMAP rows,
  -- one per case/court, all chapter 7 — so the ACMS-side chapter set stays a clean singleton
  -- {7} while the district set is the full 10-court set the district gap-check needs).
  (1, 701, 24, 10301, 'BT', 97003, 20240301, 0, ' ', 'Y', 'TR'),
  (1, 702, 24, 10302, 'BT', 97003, 20240301, 0, ' ', 'Y', 'TR'),
  (1, 703, 24, 10303, 'BT', 97003, 20240301, 0, ' ', 'Y', 'TR'),
  (1, 704, 24, 10304, 'BT', 97003, 20240301, 0, ' ', 'Y', 'TR'),
  (1, 705, 24, 10305, 'BT', 97003, 20240301, 0, ' ', 'Y', 'TR'),
  (1, 706, 24, 10306, 'BT', 97003, 20240301, 0, ' ', 'Y', 'TR'),
  (1, 707, 24, 10307, 'BT', 97003, 20240301, 0, ' ', 'Y', 'TR'),
  (1, 708, 24, 10308, 'BT', 97003, 20240301, 0, ' ', 'Y', 'TR'),
  (1, 709, 24, 10309, 'BT', 97003, 20240301, 0, ' ', 'Y', 'TR'),
  (1, 710, 24, 10310, 'BT', 97003, 20240301, 0, ' ', 'Y', 'TR');
GO
