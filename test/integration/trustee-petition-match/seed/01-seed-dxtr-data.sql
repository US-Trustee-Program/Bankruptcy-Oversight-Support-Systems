-- Fixture rows for the trustee-petition-match integration test. Idempotent: safe to re-run.
-- One test case with a trustee party, plus one 'A'/'TR' appointment transaction and one
-- '1'/'1' petition transaction — the two event types SyncTrusteeCaseAppointmentsUseCase
-- reads via getTrusteeAppointments() and getTrusteePetitionEvents().
--
-- Division: CS_DIV='081', GRP_DES='NY', COURT_ID='0208', CS_DIV_ACMS='081'
--   → courtDivisionCode "081" (Manhattan), matches the real AO_CS_DIV row for div 081.
-- Case: CS_CASEID='999999001', CASE_ID='26-99999' → caseId "081-26-99999"
-- Trustee professional id: GROUP_DESIGNATOR='NY' + PROF_CODE='00063' → "NY-00063"

DELETE FROM dbo.AO_TX WHERE CS_CASEID = '999999001' AND COURT_ID = '0208';
GO

DELETE FROM dbo.AO_PY WHERE CS_CASEID = '999999001' AND COURT_ID = '0208';
GO

DELETE FROM dbo.AO_CS WHERE CS_CASEID = '999999001' AND COURT_ID = '0208';
GO

DELETE FROM dbo.AO_CS_DIV WHERE CS_DIV = '081' AND GRP_DES = 'NY';
GO

INSERT INTO dbo.AO_CS_DIV (CS_DIV, GRP_DES, COURT_ID, CS_DIV_ACMS)
VALUES ('081', 'NY', '0208', '081');
GO

INSERT INTO dbo.AO_CS (CS_CASEID, COURT_ID, CASE_ID, CS_DIV, CS_CHAPTER)
VALUES ('999999001', '0208', '26-99999', '081', '7');
GO

INSERT INTO dbo.AO_PY (
  CS_CASEID, COURT_ID, PY_ROLE,
  PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION,
  PY_ADDRESS1, PY_ADDRESS2, PY_ADDRESS3, PY_CITY, PY_STATE, PY_ZIP, PY_COUNTRY,
  PY_PHONENO, PY_FAX_PHONE, PY_E_MAIL
)
VALUES (
  '999999001', '0208', 'tr',
  'Integration', '', 'Trustee', '',
  '100 Integration Ave', '', '', 'Washington', 'DC', '20001', 'USA',
  '202-555-0199', '', 'integration.trustee@example.com'
);
GO

-- Appointment transaction: TX_TYPE='A', TX_CODE='TR'. REC packs profCode at
-- position 17-21 and aptDate (YYMMDD) at position 24-29.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES (
  '999999001', '0208', 'A', 'TR', '2026-06-01T00:00:00',
  STUFF(STUFF(REPLICATE(' ', 237), 17, 5, '00063'), 24, 6, '260601')
);
GO

-- Petition transaction: TX_TYPE='1', TX_CODE='1'. REC packs profCode at
-- position 86-90 and aptDate (YYMMDD) at position 91-96.
INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
VALUES (
  '999999001', '0208', '1', '1', '2026-03-01T00:00:00',
  STUFF(STUFF(REPLICATE(' ', 237), 86, 5, '00063'), 91, 6, '260301')
);
GO
