-- Fixture rows for the trustee-match-scenarios integration test. Idempotent: safe to re-run.
-- Eleven cases, each exercising one distinct outcome branch of the existing (pre-Slice-5)
-- trustee matching algorithm in sync-trustee-case-appointments.ts / trustee-match.helpers.ts.
-- See scripts/trustee-match-scenarios-harness.ts for the matching Cosmos fixtures and full
-- per-scenario commentary.
--
-- Divisions:
--   CS_DIV='083', GRP_DES='MS', COURT_ID='0210', CS_DIV_ACMS='083' — all scenarios except #1
--   CS_DIV='084', GRP_DES='XX', COURT_ID='0210', CS_DIV_ACMS='084' — #1 only (reserved id
--     requires GRP_DES='XX' so acmsProfessionalId comes out as the reserved 'XX-99999')

DELETE FROM dbo.AO_TX WHERE CS_CASEID BETWEEN '999999400' AND '999999412' AND COURT_ID = '0210';
GO

DELETE FROM dbo.AO_PY WHERE CS_CASEID BETWEEN '999999400' AND '999999412' AND COURT_ID = '0210';
GO

DELETE FROM dbo.AO_CS WHERE CS_CASEID BETWEEN '999999400' AND '999999412' AND COURT_ID = '0210';
GO

DELETE FROM dbo.AO_CS_DIV WHERE (CS_DIV = '083' AND GRP_DES = 'MS') OR (CS_DIV = '084' AND GRP_DES = 'XX');
GO

INSERT INTO dbo.AO_CS_DIV (CS_DIV, GRP_DES, COURT_ID, CS_DIV_ACMS)
VALUES
  ('083', 'MS', '0210', '083'),
  ('084', 'XX', '0210', '084');
GO

INSERT INTO dbo.AO_CS (CS_CASEID, COURT_ID, CASE_ID, CS_DIV, CS_CHAPTER)
VALUES
  ('999999400', '0210', '26-88900', '084', '7'), -- 1. reserved-id-skip
  ('999999401', '0210', '26-88901', '083', '7'), -- 2. perfect-match-professional-id
  ('999999402', '0210', '26-88902', '083', '7'), -- 3. perfect-match-by-name
  ('999999403', '0210', '26-88903', '083', '7'), -- 4. perfect-match-inactive-status
  ('999999404', '0210', '26-88904', '083', '7'), -- 5. imperfect-match
  ('999999405', '0210', '26-88905', '083', '7'), -- 6. no-match
  ('999999406', '0210', '26-88906', '083', '7'), -- 7. multiple-match-high-confidence
  ('999999407', '0210', '26-88907', '083', '7'), -- 8. multiple-match-no-winner
  ('999999408', '0210', '26-88908', '083', '7'), -- 9. case-not-yet-synced
  ('999999409', '0210', '26-88909', '083', '7'), -- 10. case-moved
  ('999999410', '0210', '26-88910', '083', '7'), -- 11. re-verification
  ('999999411', '0210', '26-88911', '083', '7'), -- 12. fingerprint-repeat (Slice 5)
  ('999999412', '0210', '26-88912', '083', '7'); -- 13. fingerprint-no-false-collapse (Slice 5)
GO

-- 1. reserved-id-skip — name is irrelevant, never reached (skipped before any matching).
INSERT INTO dbo.AO_PY (
  CS_CASEID, COURT_ID, PY_ROLE, PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION,
  PY_ADDRESS1, PY_ADDRESS2, PY_ADDRESS3, PY_CITY, PY_STATE, PY_ZIP, PY_COUNTRY,
  PY_PHONENO, PY_FAX_PHONE, PY_E_MAIL
) VALUES (
  '999999400', '0210', 'tr', 'Reserved', '', 'Skip', '',
  '1 Reserved Way', '', '', 'Nowhere', 'ZZ', '00000', 'USA', '', '', ''
);
GO

-- 2. perfect-match-professional-id — resolves via FP; active appointment in same court/div/chapter.
INSERT INTO dbo.AO_PY (
  CS_CASEID, COURT_ID, PY_ROLE, PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION,
  PY_ADDRESS1, PY_ADDRESS2, PY_ADDRESS3, PY_CITY, PY_STATE, PY_ZIP, PY_COUNTRY,
  PY_PHONENO, PY_FAX_PHONE, PY_E_MAIL
) VALUES (
  '999999401', '0210', 'tr', 'Perfect', 'M', 'ProfessionalId', '',
  '1 Perfect Pid Rd', '', '', 'Scenario City', 'SC', '11111', 'USA',
  '555-100-0001', '', 'perfect.pid@example.com'
);
GO

-- 3. perfect-match-by-name — no profCode; unique CAMS trustee name; active appointment same court/div/chapter.
INSERT INTO dbo.AO_PY (
  CS_CASEID, COURT_ID, PY_ROLE, PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION,
  PY_ADDRESS1, PY_ADDRESS2, PY_ADDRESS3, PY_CITY, PY_STATE, PY_ZIP, PY_COUNTRY,
  PY_PHONENO, PY_FAX_PHONE, PY_E_MAIL
) VALUES (
  '999999402', '0210', 'tr', 'Perfect', 'N', 'ByName', '',
  '2 Perfect Name Rd', '', '', 'Scenario City', 'SC', '11111', 'USA',
  '555-100-0002', '', 'perfect.byname@example.com'
);
GO

-- 4. perfect-match-inactive-status — resolves via FP; trustee's only matching appointment
--    is voluntarily-suspended (not active), no other active appointment anywhere.
INSERT INTO dbo.AO_PY (
  CS_CASEID, COURT_ID, PY_ROLE, PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION,
  PY_ADDRESS1, PY_ADDRESS2, PY_ADDRESS3, PY_CITY, PY_STATE, PY_ZIP, PY_COUNTRY,
  PY_PHONENO, PY_FAX_PHONE, PY_E_MAIL
) VALUES (
  '999999403', '0210', 'tr', 'Inactive', 'S', 'StatusTrustee', '',
  '3 Inactive Status Rd', '', '', 'Scenario City', 'SC', '11111', 'USA',
  '555-100-0003', '', 'inactive.status@example.com'
);
GO

-- 5. imperfect-match — resolves via FP; trustee exists but has zero appointments at all, and
--    a mismatched address (proving addressScore=0 alongside districtDivision/chapter=0).
INSERT INTO dbo.AO_PY (
  CS_CASEID, COURT_ID, PY_ROLE, PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION,
  PY_ADDRESS1, PY_ADDRESS2, PY_ADDRESS3, PY_CITY, PY_STATE, PY_ZIP, PY_COUNTRY,
  PY_PHONENO, PY_FAX_PHONE, PY_E_MAIL
) VALUES (
  '999999404', '0210', 'tr', 'Imperfect', 'M', 'MatchTrustee', '',
  '4 Imperfect Rd', '', '', 'Nowhere', 'ZZ', '00000', 'USA',
  '555-100-0004', '', 'imperfect.match@example.com'
);
GO

-- 6. no-match — no profCode; fullName matches no seeded CAMS trustee at all.
INSERT INTO dbo.AO_PY (
  CS_CASEID, COURT_ID, PY_ROLE, PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION,
  PY_ADDRESS1, PY_ADDRESS2, PY_ADDRESS3, PY_CITY, PY_STATE, PY_ZIP, PY_COUNTRY,
  PY_PHONENO, PY_FAX_PHONE, PY_E_MAIL
) VALUES (
  '999999405', '0210', 'tr', 'Nobody', 'X', 'MatchesHere', '',
  '6 Nobody Rd', '', '', 'Nowhere', 'ZZ', '00000', 'USA',
  '', '', ''
);
GO

-- 7. multiple-match-high-confidence — no profCode; name ambiguous between 2 CAMS trustees,
--    but demographic data clearly favors one (the "real" one) via scoring.
INSERT INTO dbo.AO_PY (
  CS_CASEID, COURT_ID, PY_ROLE, PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION,
  PY_ADDRESS1, PY_ADDRESS2, PY_ADDRESS3, PY_CITY, PY_STATE, PY_ZIP, PY_COUNTRY,
  PY_PHONENO, PY_FAX_PHONE, PY_E_MAIL
) VALUES (
  '999999406', '0210', 'tr', 'Ambiguous', 'H', 'Winner', '',
  '7 Real Winner Rd', '', '', 'Scenario City', 'SC', '11111', 'USA',
  '555-100-0007', '', 'amb.winner.real@example.com'
);
GO

-- 8. multiple-match-no-winner — no profCode; name ambiguous between 2 CAMS trustees with
--    identical scoring inputs (a genuine tie — no clear winner).
INSERT INTO dbo.AO_PY (
  CS_CASEID, COURT_ID, PY_ROLE, PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION,
  PY_ADDRESS1, PY_ADDRESS2, PY_ADDRESS3, PY_CITY, PY_STATE, PY_ZIP, PY_COUNTRY,
  PY_PHONENO, PY_FAX_PHONE, PY_E_MAIL
) VALUES (
  '999999407', '0210', 'tr', 'Ambiguous', 'T', 'Tie', '',
  '8 Tie Rd', '', '', 'Nowhere', 'ZZ', '00000', 'USA',
  '', '', ''
);
GO

-- 9. case-not-yet-synced — resolves via FP fine; deliberately no SYNCED_CASE Cosmos doc.
INSERT INTO dbo.AO_PY (
  CS_CASEID, COURT_ID, PY_ROLE, PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION,
  PY_ADDRESS1, PY_ADDRESS2, PY_ADDRESS3, PY_CITY, PY_STATE, PY_ZIP, PY_COUNTRY,
  PY_PHONENO, PY_FAX_PHONE, PY_E_MAIL
) VALUES (
  '999999408', '0210', 'tr', 'NotYet', 'S', 'Synced', '',
  '9 Not Yet Synced Rd', '', '', 'Scenario City', 'SC', '11111', 'USA',
  '555-100-0009', '', 'notyet.synced@example.com'
);
GO

-- 10. case-moved — resolves via FP fine; the seeded SYNCED_CASE doc carries movedToCaseId.
INSERT INTO dbo.AO_PY (
  CS_CASEID, COURT_ID, PY_ROLE, PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION,
  PY_ADDRESS1, PY_ADDRESS2, PY_ADDRESS3, PY_CITY, PY_STATE, PY_ZIP, PY_COUNTRY,
  PY_PHONENO, PY_FAX_PHONE, PY_E_MAIL
) VALUES (
  '999999409', '0210', 'tr', 'Case', 'H', 'Moved', '',
  '10 Moved Case Rd', '', '', 'Scenario City', 'SC', '11111', 'USA',
  '555-100-0010', '', 'case.moved@example.com'
);
GO

-- 11. re-verification — resolves via FP to an imperfect-match on the first processing pass
--     (zero appointments, like scenario 5); a human resolution is then simulated directly in
--     Mongo before a second pass reprocesses the same event.
INSERT INTO dbo.AO_PY (
  CS_CASEID, COURT_ID, PY_ROLE, PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION,
  PY_ADDRESS1, PY_ADDRESS2, PY_ADDRESS3, PY_CITY, PY_STATE, PY_ZIP, PY_COUNTRY,
  PY_PHONENO, PY_FAX_PHONE, PY_E_MAIL
) VALUES (
  '999999410', '0210', 'tr', 'Reverify', 'M', 'Trustee', '',
  '11 Reverify Rd', '', '', 'Nowhere', 'ZZ', '00000', 'USA',
  '555-100-0011', '', 'reverify.trustee@example.com'
);
GO

-- 12. fingerprint-repeat (Slice 5) — byte-identical demographics to scenario 2 (same underlying
--     trustee), no profCode. Should auto-link via the TRUSTEE_VARIATION fingerprint bucket
--     written when scenario 2 resolved, bypassing matchTrusteeByName entirely — which would
--     otherwise be ambiguous, since scenario 2's trustee shares its name with a decoy trustee
--     seeded specifically for scenarios 12/13 (see seed-cosmos in the harness script). Must be
--     byte-identical, not merely reformatted: fingerprinting hashes raw DXTR demographics with
--     no normalization, so whitespace/case differences no longer collapse to the same fingerprint.
INSERT INTO dbo.AO_PY (
  CS_CASEID, COURT_ID, PY_ROLE, PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION,
  PY_ADDRESS1, PY_ADDRESS2, PY_ADDRESS3, PY_CITY, PY_STATE, PY_ZIP, PY_COUNTRY,
  PY_PHONENO, PY_FAX_PHONE, PY_E_MAIL
) VALUES (
  '999999411', '0210', 'tr', 'Perfect', 'M', 'ProfessionalId', '',
  '1 Perfect Pid Rd', '', '', 'Scenario City', 'SC', '11111', 'USA',
  '555-100-0001', '', 'perfect.pid@example.com'
);
GO

-- 13. fingerprint-no-false-collapse (Slice 5) — same ambiguous name as scenarios 2/12, but a
--     genuinely different underlying person (matches the decoy trustee's demographics, not
--     scenario 2's). Fingerprint must miss the scenario-2 bucket, falling through to the
--     untouched fuzzy-matching pipeline, which should resolve confidently to the decoy.
INSERT INTO dbo.AO_PY (
  CS_CASEID, COURT_ID, PY_ROLE, PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION,
  PY_ADDRESS1, PY_ADDRESS2, PY_ADDRESS3, PY_CITY, PY_STATE, PY_ZIP, PY_COUNTRY,
  PY_PHONENO, PY_FAX_PHONE, PY_E_MAIL
) VALUES (
  '999999412', '0210', 'tr', 'Perfect', 'M', 'ProfessionalId', '',
  '999 Decoy Fingerprint Ave', '', '', 'Faraway', 'FA', '99999', 'USA',
  '555-999-0000', '', 'decoy.fingerprint@example.com'
);
GO

-- Appointment transactions: TX_TYPE='A', TX_CODE='TR'. REC packs profCode at position
-- 17-21 and aptDate (YYMMDD) at position 24-29. Scenarios 3, 6, 7, 8, 12, 13 carry a blank
-- profCode (no professional-id fast path available), so the STUFF for profCode is omitted
-- for them.

-- 1. reserved-id-skip: profCode '99999', GRP_DES='XX' -> acmsProfessionalId 'XX-99999'.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999400', '0210', 'A', 'TR', '2026-01-01T00:00:00', STUFF(STUFF(REPLICATE(' ', 237), 17, 5, '99999'), 24, 6, '260101'));
GO

-- 2. perfect-match-professional-id: profCode '00001' -> 'MS-00001'.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999401', '0210', 'A', 'TR', '2026-01-02T00:00:00', STUFF(STUFF(REPLICATE(' ', 237), 17, 5, '00001'), 24, 6, '260102'));
GO

-- 3. perfect-match-by-name: no profCode.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999402', '0210', 'A', 'TR', '2026-01-03T00:00:00', STUFF(REPLICATE(' ', 237), 24, 6, '260103'));
GO

-- 4. perfect-match-inactive-status: profCode '00002' -> 'MS-00002'.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999403', '0210', 'A', 'TR', '2026-01-04T00:00:00', STUFF(STUFF(REPLICATE(' ', 237), 17, 5, '00002'), 24, 6, '260104'));
GO

-- 5. imperfect-match: profCode '00003' -> 'MS-00003'.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999404', '0210', 'A', 'TR', '2026-01-05T00:00:00', STUFF(STUFF(REPLICATE(' ', 237), 17, 5, '00003'), 24, 6, '260105'));
GO

-- 6. no-match: no profCode.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999405', '0210', 'A', 'TR', '2026-01-06T00:00:00', STUFF(REPLICATE(' ', 237), 24, 6, '260106'));
GO

-- 7. multiple-match-high-confidence: no profCode.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999406', '0210', 'A', 'TR', '2026-01-07T00:00:00', STUFF(REPLICATE(' ', 237), 24, 6, '260107'));
GO

-- 8. multiple-match-no-winner: no profCode.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999407', '0210', 'A', 'TR', '2026-01-08T00:00:00', STUFF(REPLICATE(' ', 237), 24, 6, '260108'));
GO

-- 9. case-not-yet-synced: profCode '00004' -> 'MS-00004'.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999408', '0210', 'A', 'TR', '2026-01-09T00:00:00', STUFF(STUFF(REPLICATE(' ', 237), 17, 5, '00004'), 24, 6, '260109'));
GO

-- 10. case-moved: profCode '00005' -> 'MS-00005'.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999409', '0210', 'A', 'TR', '2026-01-10T00:00:00', STUFF(STUFF(REPLICATE(' ', 237), 17, 5, '00005'), 24, 6, '260110'));
GO

-- 11. re-verification: profCode '00006' -> 'MS-00006'.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999410', '0210', 'A', 'TR', '2026-01-11T00:00:00', STUFF(STUFF(REPLICATE(' ', 237), 17, 5, '00006'), 24, 6, '260111'));
GO

-- 12. fingerprint-repeat: no profCode.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999411', '0210', 'A', 'TR', '2026-01-12T00:00:00', STUFF(REPLICATE(' ', 237), 24, 6, '260112'));
GO

-- 13. fingerprint-no-false-collapse: no profCode.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999412', '0210', 'A', 'TR', '2026-01-13T00:00:00', STUFF(REPLICATE(' ', 237), 24, 6, '260113'));
GO
