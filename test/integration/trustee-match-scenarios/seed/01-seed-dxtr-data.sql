-- Fixture rows for the trustee-match-scenarios integration test. Idempotent: safe to re-run.
-- Twelve cases (numbered 2-13; #1 (reserved-id-skip) was removed once ACMS professional ID
-- matching was retired), each exercising one distinct outcome branch of the
-- trustee matching algorithm in sync-trustee-case-appointments.ts / trustee-match.helpers.ts.
-- See scripts/trustee-match-scenarios-harness.ts for the matching Cosmos fixtures and full
-- per-scenario commentary.
--
-- Divisions:
--   CS_DIV='083', GRP_DES='MS', COURT_ID='0210', CS_DIV_ACMS='083' — all scenarios

DELETE FROM dbo.AO_TX WHERE CS_CASEID BETWEEN '999999401' AND '999999417' AND COURT_ID = '0210';
GO

DELETE FROM dbo.AO_PY WHERE CS_CASEID BETWEEN '999999401' AND '999999417' AND COURT_ID = '0210';
GO

DELETE FROM dbo.AO_CS WHERE CS_CASEID BETWEEN '999999401' AND '999999417' AND COURT_ID = '0210';
GO

DELETE FROM dbo.AO_CS_DIV WHERE CS_DIV = '083' AND GRP_DES = 'MS';
GO

INSERT INTO dbo.AO_CS_DIV (CS_DIV, GRP_DES, COURT_ID, CS_DIV_ACMS)
VALUES
  ('083', 'MS', '0210', '083');
GO

INSERT INTO dbo.AO_CS (CS_CASEID, COURT_ID, CASE_ID, CS_DIV, CS_CHAPTER, GRP_DES)
VALUES
  ('999999401', '0210', '26-88901', '083', '7', 'MS'), -- 2. perfect-match-ambiguous-name-resolved-by-scoring
  ('999999402', '0210', '26-88902', '083', '7', 'MS'), -- 3. perfect-match-by-name
  ('999999403', '0210', '26-88903', '083', '7', 'MS'), -- 4. perfect-match-inactive-status
  ('999999404', '0210', '26-88904', '083', '7', 'MS'), -- 5. imperfect-match
  ('999999405', '0210', '26-88905', '083', '7', 'MS'), -- 6. no-match
  ('999999406', '0210', '26-88906', '083', '7', 'MS'), -- 7. multiple-match-high-confidence
  ('999999407', '0210', '26-88907', '083', '7', 'MS'), -- 8. multiple-match-no-winner
  ('999999408', '0210', '26-88908', '083', '7', 'MS'), -- 9. case-not-yet-synced
  ('999999409', '0210', '26-88909', '083', '7', 'MS'), -- 10. case-moved
  ('999999410', '0210', '26-88910', '083', '7', 'MS'), -- 11. re-verification
  ('999999411', '0210', '26-88911', '083', '7', 'MS'), -- 12. fingerprint-repeat (Slice 5)
  ('999999412', '0210', '26-88912', '083', '7', 'MS'), -- 13. fingerprint-no-false-collapse (Slice 5)
  ('999999413', '0210', '26-88913', '083', '7', 'MS'), -- 14. bad-rec-date-falls-back-to-tx-date
  ('999999414', '0210', '26-88914', '083', '7', 'MS'), -- 15a. sentinel-00000-no-name-no-address
  ('999999415', '0210', '26-88915', '083', '7', 'MS'), -- 15b. sentinel-99999-bogus-name-with-contact
  ('999999416', '0210', '26-88916', '083', '7', 'MS'), -- 15c. sentinel-00000-genuine-name-and-address
  ('999999417', '0210', '26-88917', '083', '7', 'MS'); -- 15d. non-sentinel-profcode-empty-demographics
GO

-- 2. perfect-match-ambiguous-name-resolved-by-scoring — resolves via fuzzy scoring against an
-- ambiguous name collision; active appointment in same court/div/chapter.
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

-- 14. bad-rec-date-falls-back-to-tx-date — not part of the 13-scenario matching
--     pipeline (excluded from ALL_CASE_IDS); a standalone DXTR-gateway-only proof that
--     CasesDxtrGateway falls back to TX.TX_DATE when REC's embedded appointment date is blank
--     ('000000'), rather than leaving appointedDate undefined and routing the event to the DLQ.
INSERT INTO dbo.AO_PY (
  CS_CASEID, COURT_ID, PY_ROLE, PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION,
  PY_ADDRESS1, PY_ADDRESS2, PY_ADDRESS3, PY_CITY, PY_STATE, PY_ZIP, PY_COUNTRY,
  PY_PHONENO, PY_FAX_PHONE, PY_E_MAIL
) VALUES (
  '999999413', '0210', 'tr', 'BadRec', 'D', 'DateFallback', '',
  '1 Bad Rec Date Way', '', '', 'Scenario City', 'SC', '11111', 'USA',
  '555-100-0014', '', 'bad.rec.date@example.com'
);
GO

-- 15a-15d: sentinel professional code skip rule — standalone DXTR-gateway-only proofs, not
-- part of the 13-scenario matching pipeline (excluded from ALL_CASE_IDS). See
-- runSentinelProfCodeStage in the harness script for the assertions.

-- 15a. sentinel-00000-no-name-no-address: no usable demographics at all, profCode is the
--      no-trustee-appointed sentinel. Expect: event is skipped entirely (never reaches
--      matchTrusteeByName), same as the pre-existing empty-demographics rule.
INSERT INTO dbo.AO_PY (
  CS_CASEID, COURT_ID, PY_ROLE, PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION,
  PY_ADDRESS1, PY_ADDRESS2, PY_ADDRESS3, PY_CITY, PY_STATE, PY_ZIP, PY_COUNTRY,
  PY_PHONENO, PY_FAX_PHONE, PY_E_MAIL
) VALUES (
  '999999414', '0210', 'tr', '', '', '', '',
  '', '', '', '', '', '', '',
  '', '', ''
);
GO

-- 15b. sentinel-99999-bogus-name-with-contact: profCode is the professional-ID-unavailable
--      sentinel, name is a bogus/administrative placeholder (matches the "assign" keyword), but
--      contact fields ARE populated. Expect: NOT skipped — a bogus-looking name must never
--      override real contact info, since that would silently drop a genuine trustee whose name
--      happens to contain a keyword like "assign" or "trustee".
INSERT INTO dbo.AO_PY (
  CS_CASEID, COURT_ID, PY_ROLE, PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION,
  PY_ADDRESS1, PY_ADDRESS2, PY_ADDRESS3, PY_CITY, PY_STATE, PY_ZIP, PY_COUNTRY,
  PY_PHONENO, PY_FAX_PHONE, PY_E_MAIL
) VALUES (
  '999999415', '0210', 'tr', '', '', 'Not Assigned - XX', '',
  '1 Placeholder Office Way', '', '', 'Scenario City', 'SC', '11111', 'USA',
  '555-100-0015', '', 'placeholder.office@example.com'
);
GO

-- 15c. sentinel-00000-genuine-name-and-address: profCode is the no-trustee-appointed sentinel,
--      but the name is a genuine (non-bogus) synthetic name with a real address — proving DXTR's
--      inconsistent sentinel population doesn't always mean "no trustee". Expect: NOT skipped,
--      flows through normal matching.
INSERT INTO dbo.AO_PY (
  CS_CASEID, COURT_ID, PY_ROLE, PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION,
  PY_ADDRESS1, PY_ADDRESS2, PY_ADDRESS3, PY_CITY, PY_STATE, PY_ZIP, PY_COUNTRY,
  PY_PHONENO, PY_FAX_PHONE, PY_E_MAIL
) VALUES (
  '999999416', '0210', 'tr', 'Jane', 'A', 'Example', '',
  '1 Genuine Trustee Ave', '', '', 'Scenario City', 'SC', '11111', 'USA',
  '555-100-0016', '', 'jane.example@example.com'
);
GO

-- 15d. non-sentinel-profcode-empty-demographics: profCode is NOT a sentinel value, and there are
--      no usable demographics at all. Expect: skipped via the pre-existing empty-demographics
--      rule (unaffected by the new sentinel-specific logic, which never applies here).
INSERT INTO dbo.AO_PY (
  CS_CASEID, COURT_ID, PY_ROLE, PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION,
  PY_ADDRESS1, PY_ADDRESS2, PY_ADDRESS3, PY_CITY, PY_STATE, PY_ZIP, PY_COUNTRY,
  PY_PHONENO, PY_FAX_PHONE, PY_E_MAIL
) VALUES (
  '999999417', '0210', 'tr', '', '', '', '',
  '', '', '', '', '', '', '',
  '', '', ''
);
GO

-- REC's aptDate substring (position 24-29) is left blank (all spaces from REPLICATE), which
-- parseDxtrDate treats identically to the '000000' sentinel — both fail its numeric validation
-- and return undefined. TX_DATE is 2026-01-14, so a correct fallback yields appointedDate
-- '2026-01-14'.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999413', '0210', 'A', 'TR', '2026-01-14T00:00:00', REPLICATE(' ', 237));
GO

-- Appointment transactions: TX_TYPE='A', TX_CODE='TR'. REC packs aptDate (YYMMDD) at position
-- 24-29 and profCode at position 17-21 (5 chars). DXTR can supply an incorrect ACMS professional
-- code, so profCode is read solely to detect the "00000"/"99999" sentinel placeholders for the
-- skip rule (see runSentinelProfCodeStage), never as a trusted identity signal. profCode is left
-- blank throughout scenarios 2-13 below — only the 15a-15d fixtures below populate it.

-- 2. perfect-match-ambiguous-name-resolved-by-scoring.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999401', '0210', 'A', 'TR', '2026-01-02T00:00:00', STUFF(REPLICATE(' ', 237), 24, 6, '260102'));
GO

-- 3. perfect-match-by-name: no profCode.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999402', '0210', 'A', 'TR', '2026-01-03T00:00:00', STUFF(REPLICATE(' ', 237), 24, 6, '260103'));
GO

-- 4. perfect-match-inactive-status.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999403', '0210', 'A', 'TR', '2026-01-04T00:00:00', STUFF(REPLICATE(' ', 237), 24, 6, '260104'));
GO

-- 5. imperfect-match.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999404', '0210', 'A', 'TR', '2026-01-05T00:00:00', STUFF(REPLICATE(' ', 237), 24, 6, '260105'));
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

-- 9. case-not-yet-synced.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999408', '0210', 'A', 'TR', '2026-01-09T00:00:00', STUFF(REPLICATE(' ', 237), 24, 6, '260109'));
GO

-- 10. case-moved.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999409', '0210', 'A', 'TR', '2026-01-10T00:00:00', STUFF(REPLICATE(' ', 237), 24, 6, '260110'));
GO

-- 11. re-verification.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999410', '0210', 'A', 'TR', '2026-01-11T00:00:00', STUFF(REPLICATE(' ', 237), 24, 6, '260111'));
GO

-- 12. fingerprint-repeat: no profCode.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999411', '0210', 'A', 'TR', '2026-01-12T00:00:00', STUFF(REPLICATE(' ', 237), 24, 6, '260112'));
GO

-- 13. fingerprint-no-false-collapse: no profCode.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES ('999999412', '0210', 'A', 'TR', '2026-01-13T00:00:00', STUFF(REPLICATE(' ', 237), 24, 6, '260113'));
GO

-- 15a. sentinel-00000-no-name-no-address: profCode='00000' at position 17-21, aptDate at 24-29.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES (
  '999999414', '0210', 'A', 'TR', '2026-01-15T00:00:00',
  STUFF(STUFF(REPLICATE(' ', 237), 24, 6, '260115'), 17, 5, '00000')
);
GO

-- 15b. sentinel-99999-bogus-name-with-contact: profCode='99999' at position 17-21.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES (
  '999999415', '0210', 'A', 'TR', '2026-01-16T00:00:00',
  STUFF(STUFF(REPLICATE(' ', 237), 24, 6, '260116'), 17, 5, '99999')
);
GO

-- 15c. sentinel-00000-genuine-name-and-address: profCode='00000' at position 17-21.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES (
  '999999416', '0210', 'A', 'TR', '2026-01-17T00:00:00',
  STUFF(STUFF(REPLICATE(' ', 237), 24, 6, '260117'), 17, 5, '00000')
);
GO

-- 15d. non-sentinel-profcode-empty-demographics: profCode='12345' (not a sentinel value) at
--      position 17-21 — proves the sentinel-specific rule never fires for a non-sentinel code,
--      leaving the pre-existing empty-demographics rule as the only thing that can skip it.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES (
  '999999417', '0210', 'A', 'TR', '2026-01-18T00:00:00',
  STUFF(STUFF(REPLICATE(' ', 237), 24, 6, '260118'), 17, 5, '12345')
);
GO
