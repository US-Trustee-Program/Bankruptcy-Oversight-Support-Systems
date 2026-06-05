-- CMMAP_ALL Table: Unified authoritative appointment state
-- Lives in ACMS_REP_SUB alongside the existing CMMAP table and CMMAP_CAMS.
--
-- Strategy:
--   Seeded from CMMAP at cutover. Two ongoing write paths keep it current:
--     1. Daily timer trigger — merges active ACMS appointments (SOURCE='ACMS') where no
--        SOURCE='CAMS' row exists for that (case, APPT_TYPE).
--     2. CAMS event handler — upserts both CMMAP_CAMS and CMMAP_ALL in one transaction
--        for every downstream event (SOURCE='CAMS').
--
--   The SOURCE column is the ownership guard: ACMS sync never overwrites CAMS rows.
--   Downstream consumers (BOBJ, TUFR) query this table instead of CMMAP directly.

IF OBJECT_ID('dbo.CMMAP_ALL', 'U') IS NOT NULL
    DROP TABLE dbo.CMMAP_ALL;

GO

CREATE TABLE CMMAP_ALL (
    -- Soft delete flag (ACMS pattern)
    DELETE_CODE CHAR(1) NOT NULL DEFAULT ' ',

    -- Case identifiers (part of primary key)
    CASE_DIV NUMERIC(3,0) NOT NULL,
    CASE_YEAR NUMERIC(2,0) NOT NULL,
    CASE_NUMBER NUMERIC(5,0) NOT NULL,

    -- Record sequence (for multiple appointments of the same type per case)
    RECORD_SEQ_NBR NUMERIC(5,0) NOT NULL,

    -- Appointment type (part of primary key)
    -- 'S1' = Ch15 staff attorney assignment
    -- 'TR' = Trustee appointment (all chapters)
    APPT_TYPE CHAR(2) NOT NULL,

    -- Professional identifiers
    PROF_CODE NUMERIC(5,0) NOT NULL,
    GROUP_DESIGNATOR CHAR(2) NOT NULL,

    -- Appointment dates (ACMS uses numeric date format YYYYMMDD)
    APPT_DATE NUMERIC(8,0) NULL,
    APPT_DATE_DT DATETIME2(3) NULL,

    -- Disposition
    APPT_DISP CHAR(2) NULL,
    DISP_DATE NUMERIC(8,0) NULL,
    DISP_DATE_DT DATETIME2(3) NULL,

    -- Comments and metadata
    COMMENTS CHAR(30) NULL,
    APPTEE_ACTIVE CHAR(1) NOT NULL DEFAULT 'Y',
    ALPHA_SEARCH CHAR(30) NULL,
    USER_ID CHAR(10) NULL,

    -- Hearing sequence (not used by CAMS)
    HEARING_SEQUENCE NUMERIC(5,0) NULL,

    -- Region code (not used by CAMS)
    REGION_CODE CHAR(2) NULL,

    -- Audit dates - Regional (RGN) and Central DB (CDB)
    RGN_CREATE_DATE NUMERIC(8,0) NULL,
    RGN_UPDATE_DATE NUMERIC(8,0) NULL,
    RGN_CREATE_DATE_DT DATETIME2(3) NULL,
    RGN_UPDATE_DATE_DT DATETIME2(3) NULL,

    CDB_CREATE_DATE NUMERIC(8,0) NULL,
    CDB_UPDATE_DATE NUMERIC(8,0) NULL,
    CDB_CREATE_DATE_DT DATETIME2(3) NULL,
    CDB_UPDATE_DATE_DT DATETIME2(3) NULL,

    -- Update tracking
    UPDATE_DATE DATETIME2(3) NULL,

    -- ACMS replica passthrough columns (null for CAMS-sourced rows)
    REPLICATED_DATE DATETIME2(3) NULL,
    id INT NULL,
    RRN INT NULL,

    -- Source tracking — ownership guard for sync logic
    -- 'CAMS' = written by CAMS event handler (never overwritten by ACMS sync)
    -- 'ACMS' = written by daily ACMS sync job
    SOURCE VARCHAR(10) NOT NULL DEFAULT 'ACMS',

    -- Last-writer-wins timestamp — used by MERGE guards
    LAST_UPDATED DATETIME2(3) NOT NULL DEFAULT GETDATE(),

    -- Primary key: matches CMMAP composite PK plus APPT_TYPE
    CONSTRAINT PK_CMMAP_ALL PRIMARY KEY (CASE_DIV, CASE_YEAR, CASE_NUMBER, APPT_TYPE, RECORD_SEQ_NBR)
);

GO

-- Computed column for CASE_FULL_ACMS (matches ACMS/CMMAP_CAMS pattern)
ALTER TABLE CMMAP_ALL
ADD CASE_FULL_ACMS AS (
    RIGHT('000' + CAST(CASE_DIV AS VARCHAR), 3) + '-' +
    RIGHT('00' + CAST(CASE_YEAR AS VARCHAR), 2) + '-' +
    RIGHT('00000' + CAST(CASE_NUMBER AS VARCHAR), 5)
) PERSISTED;

GO

CREATE INDEX IX_CMMAP_ALL_SOURCE ON CMMAP_ALL(SOURCE);

GO

CREATE INDEX IX_CMMAP_ALL_ACTIVE ON CMMAP_ALL(APPTEE_ACTIVE, DELETE_CODE)
WHERE DELETE_CODE = ' ' AND APPTEE_ACTIVE = 'Y';

GO

CREATE INDEX IX_CMMAP_ALL_APPT_TYPE ON CMMAP_ALL(APPT_TYPE);

GO

CREATE INDEX IX_CMMAP_ALL_CDB_UPDATE ON CMMAP_ALL(CDB_UPDATE_DATE);

GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Unified authoritative appointment state. Seeded from CMMAP. Kept current by daily ACMS sync (SOURCE=ACMS) and CAMS event handler (SOURCE=CAMS). Downstream consumers query this table instead of CMMAP. SOURCE column guards CAMS-owned rows from ACMS overwrite.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'CMMAP_ALL';

GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Row ownership. CAMS=written by event handler (protected). ACMS=written by daily sync job.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'CMMAP_ALL',
    @level2type = N'COLUMN', @level2name = N'SOURCE';

GO
