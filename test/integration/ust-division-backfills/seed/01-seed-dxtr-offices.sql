-- DXTR offices fixture for the ustDivisionCode backfill harness.
--
-- Two courts, chosen to pin both sides of ustDivisionCodeSelect's CASE expression:
--
--   0649 (E.D. Tenn.) — inside UST_DIVISION_CODE_COURT_IDS. Two ACMS codes are each shared by
--   two divisions, which is the divergence CAMS-936 exists for. getOffices() must return the
--   bare CS_DIV here, so Winchester comes back as 494 rather than Chattanooga's 491.
--
--     CS_DIV | CS_DIV_ACMS | OFFICE_CODE | Office
--     -------|-------------|-------------|-------------
--     491    | 491         | 1           | Chattanooga
--     492    | 492         | 2           | Greeneville
--     493    | 493         | 3           | Knoxville
--     494    | 491         | 4           | Winchester    <- shares 491
--     495    | 492         | 5           | Johnson City  <- shares 492
--
--   Confirmed live against sql-ustp-cams AODATEX_SUB (2026); matches
--   dev-tools/db_scripts/scenarios/ust-division-tn-eastern.ts.
--
--   113E (N.D. Ga.) — OUTSIDE the scoped court list, and its codes also diverge (bare 3E1 vs
--   ACMS 321). This is the regression row: getOffices() must return the ACMS 321 for it, not
--   the bare 3E1. Emitting bare codes here would hand newly synced 113E cases a code no stored
--   TRUSTEE_APPOINTMENT in that court holds, and no backfill migrates them. Seven other courts
--   collapse divisions the same way (see cams-06edp).
--
-- Run against DXTR_INT database after seed-schema has been applied.

TRUNCATE TABLE dbo.AO_CS_DIV;
GO

TRUNCATE TABLE dbo.AO_OFFICE;
GO

TRUNCATE TABLE dbo.AO_COURT;
GO

TRUNCATE TABLE dbo.AO_GRP_DES;
GO

TRUNCATE TABLE dbo.AO_REGION;
GO

-- ── AO_REGION ────────────────────────────────────────────────────────────────

INSERT INTO dbo.AO_REGION (REGION_ID, REGION_NAME) VALUES ('08', 'ATLANTA');
GO

INSERT INTO dbo.AO_REGION (REGION_ID, REGION_NAME) VALUES ('21', 'ATLANTA-GA');
GO

-- ── AO_GRP_DES ───────────────────────────────────────────────────────────────

INSERT INTO dbo.AO_GRP_DES (GRP_DES, REGION_ID) VALUES ('CN', '08');
GO

INSERT INTO dbo.AO_GRP_DES (GRP_DES, REGION_ID) VALUES ('AT', '21');
GO

-- ── AO_COURT ─────────────────────────────────────────────────────────────────

INSERT INTO dbo.AO_COURT (COURT_ID, COURT_TITLE, COURT_NAME, DISTRICT_ALPHA)
VALUES ('0649', 'Eastern District of TN', 'Eastern District of Tennessee', 'TNE');
GO

INSERT INTO dbo.AO_COURT (COURT_ID, COURT_TITLE, COURT_NAME, DISTRICT_ALPHA)
VALUES ('113E', 'Northern District of GA', 'Northern District of Georgia', 'GAN');
GO

-- ── AO_OFFICE ────────────────────────────────────────────────────────────────
-- CAMS = 'Y' is required: getOffices() filters on it.

INSERT INTO dbo.AO_OFFICE (COURT_ID, OFFICE_CODE, OFFICE_NAME, OFFICE_NAME_DISPLAY, CAMS)
VALUES ('0649', '1', 'Chattanooga', 'Chattanooga', 'Y');
GO

INSERT INTO dbo.AO_OFFICE (COURT_ID, OFFICE_CODE, OFFICE_NAME, OFFICE_NAME_DISPLAY, CAMS)
VALUES ('0649', '2', 'Greeneville', 'Greeneville', 'Y');
GO

INSERT INTO dbo.AO_OFFICE (COURT_ID, OFFICE_CODE, OFFICE_NAME, OFFICE_NAME_DISPLAY, CAMS)
VALUES ('0649', '3', 'Knoxville', 'Knoxville', 'Y');
GO

INSERT INTO dbo.AO_OFFICE (COURT_ID, OFFICE_CODE, OFFICE_NAME, OFFICE_NAME_DISPLAY, CAMS)
VALUES ('0649', '4', 'Winchester', 'Winchester', 'Y');
GO

INSERT INTO dbo.AO_OFFICE (COURT_ID, OFFICE_CODE, OFFICE_NAME, OFFICE_NAME_DISPLAY, CAMS)
VALUES ('0649', '5', 'Johnson City', 'Johnson City', 'Y');
GO

INSERT INTO dbo.AO_OFFICE (COURT_ID, OFFICE_CODE, OFFICE_NAME, OFFICE_NAME_DISPLAY, CAMS)
VALUES ('113E', '1', 'Atlanta', 'Atlanta', 'Y');
GO

-- ── AO_CS_DIV ────────────────────────────────────────────────────────────────

INSERT INTO dbo.AO_CS_DIV (CS_DIV, GRP_DES, COURT_ID, OFFICE_CODE, STATE, NBDB, PDF_PATH_ID, CS_DIV_ACMS, CS_DIV_NBDB)
VALUES ('491', 'CN', '0649', '1', 'TN', 'CN', 1, '491', '491');
GO

INSERT INTO dbo.AO_CS_DIV (CS_DIV, GRP_DES, COURT_ID, OFFICE_CODE, STATE, NBDB, PDF_PATH_ID, CS_DIV_ACMS, CS_DIV_NBDB)
VALUES ('492', 'CN', '0649', '2', 'TN', 'CN', 1, '492', '492');
GO

INSERT INTO dbo.AO_CS_DIV (CS_DIV, GRP_DES, COURT_ID, OFFICE_CODE, STATE, NBDB, PDF_PATH_ID, CS_DIV_ACMS, CS_DIV_NBDB)
VALUES ('493', 'CN', '0649', '3', 'TN', 'CN', 1, '493', '493');
GO

INSERT INTO dbo.AO_CS_DIV (CS_DIV, GRP_DES, COURT_ID, OFFICE_CODE, STATE, NBDB, PDF_PATH_ID, CS_DIV_ACMS, CS_DIV_NBDB)
VALUES ('494', 'CN', '0649', '4', 'TN', 'CN', 1, '491', '491');
GO

INSERT INTO dbo.AO_CS_DIV (CS_DIV, GRP_DES, COURT_ID, OFFICE_CODE, STATE, NBDB, PDF_PATH_ID, CS_DIV_ACMS, CS_DIV_NBDB)
VALUES ('495', 'CN', '0649', '5', 'TN', 'CN', 1, '492', '492');
GO

-- Outside the scoped court list, and divergent: bare 3E1 vs ACMS 321.
INSERT INTO dbo.AO_CS_DIV (CS_DIV, GRP_DES, COURT_ID, OFFICE_CODE, STATE, NBDB, PDF_PATH_ID, CS_DIV_ACMS, CS_DIV_NBDB)
VALUES ('3E1', 'AT', '113E', '1', 'GA', 'AT', 81, '321', '321');
GO
