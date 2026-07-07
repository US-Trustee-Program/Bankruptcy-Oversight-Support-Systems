-- Seed ATS fixtures for the DEDUP (duplicate-trustee) verification flow.
-- Drop and recreate so the test is fully idempotent.
--
-- These fixtures validate three duplicate-trustee fixes by running the REAL
-- MIGRATE-TRUSTEES dataflow TWICE and asserting NO duplicate Cosmos docs are
-- created on run 2:
--   M1  — findTrusteeByNameAndState lookahead-only regex matches composite names
--         whose tokens end in punctuation ("J. Ford Elsaesser", "William A.
--         Brandt, Jr.")
--   M2  — upsertTrustee dedup key sources state from the TRANSFORMED public
--         address (public.address.state = STATE_A2 when a2IsPublic), not raw
--         STATE (Merrill Cohen: STATE=MD, STATE_A2=DE -> public state = DE)
--   fallback — transformTrusteeRecord backfills the public state from the OTHER
--         address when the selected public state is empty, so the record is
--         persisted (not skipped for a blank state)
--
-- WHY A NORMAL (non-importAll) RUN PICKS THESE UP
-- ------------------------------------------------
-- The HTTP trigger enqueues an empty {} start message (no flags), so the
-- migration runs with importAll = undefined. In that mode
-- AtsGatewayImpl.getTrusteesPage adds a WHERE EXISTS filter requiring each
-- trustee to have at least one CHAPTER_DETAILS row whose STATUS is in
-- ACTIVE_STATUS_CODES (derived from TOD_STATUS_MAP entries with status
-- 'active'). Each fixture below therefore gets ONE active CHAPTER_DETAILS row
-- with STATUS 'PA' (panel / active) so a default run returns it AND exercises
-- appointment creation.
--
-- APPOINTMENT COURT MAPPING
-- -------------------------
-- The appointment court is resolved from CHAPTER_DETAILS.SERVING_STATE (read
-- by ats.gateway as "SERVING_STATE AS STATE") through the cleansing pipeline's
-- STATE_TO_SINGLE_COURT_ID map, which is keyed by FULL STATE NAMES (not the
-- 2-char abbreviation). We use single-court states so no DISTRICT is required
-- and the court resolves against a real DXTR office:
--   Idaho       -> 0976
--   Arizona     -> 0970
--   Maryland    -> 0416
--   Connecticut -> 0205
-- NOTE: SERVING_STATE holds the full state NAME on purpose. The trustee's own
-- address STATE (2-char, in the TRUSTEES table) is separate and drives the
-- dedup key + the ACMS professional-id lookup (see 03-seed-acms-cmmpr.sql).
--
-- Uses ATS IDs 1004-1008 (distinct from 01-seed-trustees.sql's 1001-1003).

-- IMPORTANT: On the shared server the ATS database is NOT named ATS_INT. Use
-- the database named by ATS_MSSQL_DATABASE in backend/.env.
USE ATS_SUB
GO

DELETE FROM CHAPTER_DETAILS WHERE TRU_ID IN (1004, 1005, 1006, 1007, 1008)
GO
DELETE FROM TRUSTEES WHERE ID IN (1004, 1005, 1006, 1007, 1008)
GO

-- TRUSTEES.ID is an IDENTITY column, so explicit ids require IDENTITY_INSERT.
-- All five inserts share ONE batch with the toggle (IDENTITY_INSERT is
-- connection-scoped; keeping the ON/OFF and inserts in a single batch is robust
-- regardless of connection pooling).
SET IDENTITY_INSERT dbo.TRUSTEES ON

-- 1004 (M1a): punctuation in FIRST name ("J.") + MIDDLE "Ford".
-- DISP_ON_WEB='y' so a2IsPublic=false; public.address.state = STATE = 'ID'.
-- Composite name computed as "J. Ford Elsaesser".
-- On run 2 the lookahead-only regex must match this punctuation-ending first token.
INSERT INTO TRUSTEES
  (ID, LAST_NAME, FIRST_NAME, MIDDLE, COMPANY,
   STREET, STREET1, CITY, STATE, ZIP, ZIP_PLUS,
   DISP_ON_WEB, DISP_ON_WEB_A2,
   STREET_A2, STREET1_A2, CITY_A2, STATE_A2, ZIP_A2, ZIP_PLUS_A2,
   TELEPHONE, EMAIL_ADDRESS)
VALUES
  (1004, 'Elsaesser', 'J.', 'Ford', NULL,
   '320 E Neider Ave', NULL, 'Coeur d''Alene', 'ID', '83815', NULL,
   'y', 'n',
   NULL, NULL, NULL, NULL, NULL, NULL,
   NULL, 'j.elsaesser@example.com')

-- 1005 (M1b): punctuation/suffix in LAST name ("Brandt, Jr.") + MIDDLE "A.".
-- DISP_ON_WEB='y' so a2IsPublic=false; public.address.state = STATE = 'AZ'.
-- Composite name computed as "William A. Brandt, Jr.".
-- On run 2 the lookahead-only regex must match this punctuation-ending last token.
INSERT INTO TRUSTEES
  (ID, LAST_NAME, FIRST_NAME, MIDDLE, COMPANY,
   STREET, STREET1, CITY, STATE, ZIP, ZIP_PLUS,
   DISP_ON_WEB, DISP_ON_WEB_A2,
   STREET_A2, STREET1_A2, CITY_A2, STATE_A2, ZIP_A2, ZIP_PLUS_A2,
   TELEPHONE, EMAIL_ADDRESS)
VALUES
  (1005, 'Brandt, Jr.', 'William', 'A.', NULL,
   '2390 E Camelback Rd', NULL, 'Phoenix', 'AZ', '85016', NULL,
   'y', 'n',
   NULL, NULL, NULL, NULL, NULL, NULL,
   NULL, 'william.brandt@example.com')

-- 1006 (M2): STATE != STATE_A2, A2 is public. DISP_ON_WEB='n', DISP_ON_WEB_A2='y'
-- so a2IsPublic=true. Public address = A2 fields (STATE_A2='DE'); internal address
-- = primary fields (STATE='MD'). Composite name = "Merrill Cohen" (no punctuation).
-- On run 2 the dedup key must use the transformed public state 'DE' (not raw 'MD')
-- to find the existing doc.
--   Expected persisted: public.address.state='DE', internal.address.state='MD'.
INSERT INTO TRUSTEES
  (ID, LAST_NAME, FIRST_NAME, MIDDLE, COMPANY,
   STREET, STREET1, CITY, STATE, ZIP, ZIP_PLUS,
   DISP_ON_WEB, DISP_ON_WEB_A2,
   STREET_A2, STREET1_A2, CITY_A2, STATE_A2, ZIP_A2, ZIP_PLUS_A2,
   TELEPHONE, EMAIL_ADDRESS)
VALUES
  (1006, 'Cohen', 'Merrill', NULL, NULL,
   '30 W Gude Dr', NULL, 'Rockville', 'MD', '20852', NULL,
   'n', 'y',
   'P. O. Box 53', NULL, 'Harbeson', 'DE', '19951', NULL,
   NULL, 'merrill.cohen@example.com')

-- 1007 (fallback): A2 is public but STATE_A2 is empty. DISP_ON_WEB='n',
-- DISP_ON_WEB_A2='y' so a2IsPublic=true, but the selected public STATE_A2 is blank,
-- so the public state backfills from the other address's STATE ('MD').
-- Composite name = "Test Fallback".
--   Expected persisted: public.address.state='MD' (backfilled), doc EXISTS (not skipped).
INSERT INTO TRUSTEES
  (ID, LAST_NAME, FIRST_NAME, MIDDLE, COMPANY,
   STREET, STREET1, CITY, STATE, ZIP, ZIP_PLUS,
   DISP_ON_WEB, DISP_ON_WEB_A2,
   STREET_A2, STREET1_A2, CITY_A2, STATE_A2, ZIP_A2, ZIP_PLUS_A2,
   TELEPHONE, EMAIL_ADDRESS)
VALUES
  (1007, 'Fallback', 'Test', NULL, NULL,
   '100 N Charles St', NULL, 'Baltimore', 'MD', '21201', NULL,
   'n', 'y',
   '400 Public Blvd', NULL, 'Somewhere', '', '00000', NULL,
   NULL, 'test.fallback@example.com')

-- 1008 (control): a clean record with no punctuation and no A2 public address.
-- DISP_ON_WEB='y' so a2IsPublic=false; public.address.state = STATE = 'CT'.
-- Composite name = "Jane Control". Confirms the flow itself doesn't spuriously
-- duplicate a well-behaved record.
INSERT INTO TRUSTEES
  (ID, LAST_NAME, FIRST_NAME, MIDDLE, COMPANY,
   STREET, STREET1, CITY, STATE, ZIP, ZIP_PLUS,
   DISP_ON_WEB, DISP_ON_WEB_A2,
   STREET_A2, STREET1_A2, CITY_A2, STATE_A2, ZIP_A2, ZIP_PLUS_A2,
   TELEPHONE, EMAIL_ADDRESS)
VALUES
  (1008, 'Control', 'Jane', NULL, NULL,
   '265 Church St', NULL, 'New Haven', 'CT', '06510', NULL,
   'y', 'n',
   NULL, NULL, NULL, NULL, NULL, NULL,
   NULL, 'jane.control@example.com')

SET IDENTITY_INSERT dbo.TRUSTEES OFF
GO

-- Active chapter appointments so a NORMAL (non-importAll) run returns each trustee
-- (STATUS 'PA' is in ACTIVE_STATUS_CODES) and exercises appointment court-mapping.
-- SERVING_STATE holds the FULL STATE NAME (single-court states -> no DISTRICT needed):
--   Idaho -> 0976, Arizona -> 0970, Maryland -> 0416, Connecticut -> 0205.
INSERT INTO CHAPTER_DETAILS
  (TRU_ID, DISTRICT, SERVING_STATE, CHAPTER, APPOINTED_DATE, STATUS, STATUS_EFF_DATE, ARCHIVE_DATE)
VALUES
  (1004, NULL, 'Idaho',       '7', '2015-01-01', 'PA', '2015-01-01', NULL),
  (1005, NULL, 'Arizona',     '7', '2016-02-01', 'PA', '2016-02-01', NULL),
  (1006, NULL, 'Maryland',    '7', '2017-03-01', 'PA', '2017-03-01', NULL),
  (1007, NULL, 'Maryland',    '7', '2018-04-01', 'PA', '2018-04-01', NULL),
  (1008, NULL, 'Connecticut', '7', '2019-05-01', 'PA', '2019-05-01', NULL)
GO
