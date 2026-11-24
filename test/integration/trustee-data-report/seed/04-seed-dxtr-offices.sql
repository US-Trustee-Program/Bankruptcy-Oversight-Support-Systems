-- DXTR offices rows for the trustee data report harness, copied from
-- test/integration/sync-acms-professional-ids/seed/01-seed-dxtr-offices.sql:
--
--   NY -> CS_DIV 081, COURT_ID 0208 (S.D.N.Y. / Manhattan)
--   UT -> CS_DIV 066, COURT_ID 0206 (N.D.N.Y. / Utica; 'UT' is the real
--         designator for Utica, NY, not Utah)
--
-- Slice 1 needs only that offices can be read. Slice 2 appointment
-- scenarios add the districts they use.
--
-- Run against the DXTR_INT database after seed-schema has been applied.

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

INSERT INTO dbo.AO_REGION (REGION_ID, REGION_NAME)
VALUES ('02', 'NEW YORK');
GO

-- ── AO_GRP_DES ───────────────────────────────────────────────────────────────

INSERT INTO dbo.AO_GRP_DES (GRP_DES, REGION_ID)
VALUES ('NY', '02');
GO

INSERT INTO dbo.AO_GRP_DES (GRP_DES, REGION_ID)
VALUES ('UT', '02');
GO

-- ── AO_COURT ─────────────────────────────────────────────────────────────────

INSERT INTO dbo.AO_COURT (COURT_ID, COURT_TITLE, COURT_NAME, DISTRICT_ALPHA)
VALUES ('0208', 'United States Bankruptcy Court', 'Southern District of New York', 'NY');
GO

INSERT INTO dbo.AO_COURT (COURT_ID, COURT_TITLE, COURT_NAME, DISTRICT_ALPHA)
VALUES ('0206', 'United States Bankruptcy Court', 'Northern District of New York', 'AL');
GO

-- ── AO_OFFICE ────────────────────────────────────────────────────────────────

INSERT INTO dbo.AO_OFFICE (COURT_ID, OFFICE_CODE, OFFICE_NAME, OFFICE_NAME_DISPLAY, CAMS)
VALUES ('0208', '1', 'Manhattan', 'Manhattan', 'Y');
GO

INSERT INTO dbo.AO_OFFICE (COURT_ID, OFFICE_CODE, OFFICE_NAME, OFFICE_NAME_DISPLAY, CAMS)
VALUES ('0206', '6', 'Utica', 'Utica', 'Y');
GO

-- ── AO_CS_DIV ────────────────────────────────────────────────────────────────

INSERT INTO dbo.AO_CS_DIV (CS_DIV, GRP_DES, COURT_ID, OFFICE_CODE, STATE, CS_DIV_ACMS)
VALUES ('081', 'NY', '0208', '1', 'NY', '081');
GO

INSERT INTO dbo.AO_CS_DIV (CS_DIV, GRP_DES, COURT_ID, OFFICE_CODE, STATE, CS_DIV_ACMS)
VALUES ('066', 'UT', '0206', '6', 'NY', '066');
GO

PRINT 'DXTR offices seeded: 2 groups (NY, UT)';
GO
