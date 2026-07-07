-- Seed ACMS CMMPR fixture rows so the trustee migration's professional-id
-- lookup resolves for the dedup fixtures (ATS IDs 1004-1008).
-- Drop and recreate so the test is fully idempotent.
--
-- WHAT THE MIGRATION QUERIES
-- --------------------------
-- AcmsGatewayImpl.getTrusteeProfessionalIds runs, server-side:
--
--   SELECT CONCAT(GROUP_DESIGNATOR, '-', RIGHT(CONCAT('0000', UST_PROF_CODE), 5))
--   FROM [dbo].[CMMPR]
--   WHERE PROF_FIRST_NAME = @firstName
--     AND PROF_LAST_NAME  = @lastName
--     AND PROF_STATE      = @state
--     AND (PROF_TYPE = 'TR' OR PROF_TYPE IS NULL)
--
-- The migration passes the RAW primary record values (migrate-trustees use case
-- upsertProfessionalIds is called with primary.FIRST_NAME / primary.LAST_NAME /
-- primary.STATE) — i.e. the 2-char address STATE, NOT the transformed public
-- state and NOT the CHAPTER_DETAILS SERVING_STATE. So PROF_FIRST_NAME /
-- PROF_LAST_NAME / PROF_STATE below MUST match each fixture's RAW name + STATE
-- exactly:
--   1004  'J.'      / 'Elsaesser'    / 'ID'
--   1005  'William' / 'Brandt, Jr.'  / 'AZ'
--   1006  'Merrill' / 'Cohen'        / 'MD'
--   1007  'Test'    / 'Fallback'     / 'MD'
--   1008  'Jane'    / 'Control'      / 'CT'
--
-- COLUMNS SEEDED (the ones the query needs):
--   GROUP_DESIGNATOR  (2-char) — first half of the returned professional id
--   UST_PROF_CODE               — right-padded to 5 digits for the id
--   PROF_FIRST_NAME, PROF_LAST_NAME, PROF_STATE, PROF_TYPE
--
-- We use a reserved UST_PROF_CODE block 99001-99005 so cleanup is unambiguous.
--
-- <PLACEHOLDER: any additional NOT NULL columns in your CMMPR table>
-- We do NOT have the production CMMPR DDL. If your CMMPR table has additional
-- NOT NULL / no-default columns, add them to BOTH the column list and VALUES
-- rows below, or these INSERTs will fail. The six columns above are the only
-- ones the migration query reads.

-- IMPORTANT: ACMS is a DIFFERENT database than ATS (though on the same shared
-- server). Use the database named by ACMS_MSSQL_DATABASE in backend/.env.
USE ACMS_REP_SUB
GO

-- Idempotent cleanup by the reserved UST_PROF_CODE block.
DELETE FROM [dbo].[CMMPR] WHERE UST_PROF_CODE IN (99001, 99002, 99003, 99004, 99005)
GO

INSERT INTO [dbo].[CMMPR]
  (GROUP_DESIGNATOR, UST_PROF_CODE, PROF_FIRST_NAME, PROF_LAST_NAME, PROF_STATE, PROF_TYPE)
VALUES
  ('09', 99001, 'J.',      'Elsaesser',   'ID', 'TR'),  -- ATS 1004 -> "09-99001"
  ('14', 99002, 'William', 'Brandt, Jr.', 'AZ', 'TR'),  -- ATS 1005 -> "14-99002"
  ('04', 99003, 'Merrill', 'Cohen',       'MD', 'TR'),  -- ATS 1006 -> "04-99003"
  ('04', 99004, 'Test',    'Fallback',    'MD', 'TR'),  -- ATS 1007 -> "04-99004"
  ('01', 99005, 'Jane',    'Control',     'CT', 'TR')   -- ATS 1008 -> "01-99005"
GO
