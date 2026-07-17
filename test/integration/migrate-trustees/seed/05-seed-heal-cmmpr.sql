-- CMMPR fixture rows for the heal() intent (backfillProfessionalIds use case).
-- Drives the ACMS -> CAMS inverse professional-ID backfill, independent of ATS.
--
-- getAllTrusteeProfessionalRecords runs, server-side, against ACMS_INT:
--
--   SELECT CONCAT(GROUP_DESIGNATOR, '-', RIGHT(CONCAT('0000', UST_PROF_CODE), 5))
--   FROM [dbo].[CMMPR]
--   WHERE PROF_TYPE = 'TR'
--
-- so every 'TR' row in this table is scanned by the harness's Step 9, not just
-- the three fixture rows below. Per the ACMS data dictionary (Professional
-- Master File), CMMPR's professional-code column is UST_PROF_CODE NUMERIC(5,0).
-- Reserved UST_PROF_CODE block 98001-98005 keeps cleanup unambiguous.
--
--   98001  'Heal'   / 'Newmatch'  / 'IL'  — no existing mapping, matches CAMS
--          trustee "Heal Newmatch" (IL) seeded by the harness -> created
--   98002  'Heal'   / 'Existing'  / 'IL'  — mapping pre-created by the harness
--          before backfill runs -> alreadyMapped, not re-created
--   98003  'Heal'   / 'Nomatch'   / 'ZZ'  — no CAMS trustee matches -> unmatched
--   98004  'Heal'   / 'Newmatch'  / 'IL'  — same name+state as 98001, distinct
--          professional ID; the SAME CAMS trustee gets a SECOND mapping,
--          exercising one-CAMS-trustee-to-many-ACMS-IDs -> created
--   98005  'Heal'   / '' (blank)  / 'IL'  — blank last name (fixed-width CHAR
--          padded to spaces, trims to empty) -> INCOMPLETE_NAME_OR_STATE,
--          routed to unmatched WITHOUT a trustee lookup

USE ACMS_INT
GO

IF OBJECT_ID('dbo.CMMPR', 'U') IS NOT NULL DROP TABLE dbo.CMMPR
GO

CREATE TABLE CMMPR (
    DELETE_CODE CHAR(1) NOT NULL DEFAULT ' ',
    UST_PROF_CODE NUMERIC(5,0) NOT NULL,
    GROUP_DESIGNATOR CHAR(2) NOT NULL,
    PROF_LAST_NAME CHAR(30),
    PROF_FIRST_NAME CHAR(20),
    PROF_STATE CHAR(2),
    PROF_TYPE CHAR(2),
    UPDATE_DATE DATETIME2(3),
    PRIMARY KEY (UST_PROF_CODE, GROUP_DESIGNATOR)
)
GO

DELETE FROM CMMPR WHERE UST_PROF_CODE IN (98001, 98002, 98003, 98004, 98005) AND GROUP_DESIGNATOR = 'HL'
GO

INSERT INTO CMMPR
  (DELETE_CODE, UST_PROF_CODE, GROUP_DESIGNATOR, PROF_LAST_NAME, PROF_FIRST_NAME, PROF_STATE, PROF_TYPE, UPDATE_DATE)
VALUES
  (' ', 98001, 'HL', 'Newmatch', 'Heal', 'IL', 'TR', GETDATE()),  -- -> "HL-98001"
  (' ', 98002, 'HL', 'Existing', 'Heal', 'IL', 'TR', GETDATE()),  -- -> "HL-98002"
  (' ', 98003, 'HL', 'Nomatch',  'Heal', 'ZZ', 'TR', GETDATE()),  -- -> "HL-98003"
  (' ', 98004, 'HL', 'Newmatch', 'Heal', 'IL', 'TR', GETDATE()),  -- -> "HL-98004" (1-to-many)
  (' ', 98005, 'HL', '',         'Heal', 'IL', 'TR', GETDATE())   -- -> "HL-98005" (incomplete)
GO
