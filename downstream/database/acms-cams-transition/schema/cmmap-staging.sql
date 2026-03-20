-- CMMAP_STAGING: Staging table for CAMS case assignments
-- Matches ACMS CMMAP schema for Chapter 15 attorney assignments
-- Source: CAMS CaseAssignmentEvent → Azure Function → This table

CREATE TABLE CMMAP_STAGING (
    -- Soft delete flag (ACMS pattern)
    DELETE_CODE CHAR(1) NOT NULL DEFAULT ' ',

    -- Case identifiers (composite key)
    CASE_DIV NUMERIC(5,3) NOT NULL,
    CASE_YEAR NUMERIC(5,2) NOT NULL,
    CASE_NUMBER NUMERIC(5,5) NOT NULL,

    -- Record sequence (for multiple appointments per case)
    -- For Chapter 15, we only have one attorney (S1), so this is always 1
    RECORD_SEQ_NBR NUMERIC(5,5) NOT NULL DEFAULT 1,

    -- Professional identifiers
    -- PLACEHOLDER: Professional ID mapping strategy TBD
    -- Options: "ZZ-{incrementing_int}" OR "{GROUP_DESIGNATOR}-{decrementing_int}"
    PROF_CODE NUMERIC(5,5) NOT NULL,
    GROUP_DESIGNATOR CHAR(2) NOT NULL,

    -- Appointment type
    -- For Chapter 15 attorney assignments, this is 'S1' (staff type 1)
    APPT_TYPE CHAR(2) NOT NULL DEFAULT 'S1',

    -- Appointment dates (ACMS uses numeric date format YYYYMMDD)
    APPT_DATE NUMERIC(9,11) NULL,
    APPT_DATE_DT DATETIME2(3) NULL,

    -- Disposition (termination/unassignment)
    APPT_DISP CHAR(2) NULL,
    DISP_DATE NUMERIC(9,11) NULL,
    DISP_DATE_DT DATETIME2(3) NULL,

    -- Comments and metadata
    COMMENTS CHAR(30) NULL,
    APPTEE_ACTIVE CHAR(1) NOT NULL DEFAULT 'Y',
    ALPHA_SEARCH CHAR(30) NULL,  -- Usually attorney last name for searching
    USER_ID CHAR(10) NULL,       -- ACMS user who created record

    -- Hearing sequence (not used for Chapter 15)
    HEARING_SEQUENCE NUMERIC(5,5) NULL,

    -- Region code (not used in current CAMS)
    REGION_CODE CHAR(2) NULL,

    -- Audit dates - Regional (RGN) and Central DB (CDB)
    RGN_CREATE_DATE NUMERIC(5,8) NULL,
    RGN_UPDATE_DATE NUMERIC(5,8) NULL,
    RGN_CREATE_DATE_DT DATETIME2(3) NULL,
    RGN_UPDATE_DATE_DT DATETIME2(3) NULL,

    CDB_CREATE_DATE NUMERIC(5,8) NULL,
    CDB_UPDATE_DATE NUMERIC(5,8) NULL,
    CDB_CREATE_DATE_DT DATETIME2(3) NULL,
    CDB_UPDATE_DATE_DT DATETIME2(3) NULL,

    -- Full case ID (computed)
    CASE_FULL_ACMS VARCHAR(10) NULL,

    -- Update tracking
    UPDATE_DATE DATETIME2(3) NOT NULL DEFAULT GETDATE(),

    -- CAMS-specific metadata (not in ACMS CMMAP)
    SOURCE VARCHAR(10) NOT NULL DEFAULT 'CAMS',
    CAMS_CASE_ID VARCHAR(50) NOT NULL,     -- Original CAMS case ID
    CAMS_USER_ID VARCHAR(50) NOT NULL,     -- Original CAMS user ID
    CAMS_USER_NAME VARCHAR(100) NOT NULL,  -- Attorney name from CAMS
    LAST_UPDATED DATETIME2 NOT NULL DEFAULT GETDATE(),

    -- Primary key matches ACMS CMMAP
    CONSTRAINT PK_CMMAP_STAGING PRIMARY KEY (CASE_DIV, CASE_YEAR, CASE_NUMBER, RECORD_SEQ_NBR),

    -- Indexes for common queries
    CONSTRAINT IX_CMMAP_STAGING_PROF UNIQUE (PROF_CODE, GROUP_DESIGNATOR, CASE_DIV, CASE_YEAR, CASE_NUMBER),
    CONSTRAINT IX_CMMAP_STAGING_CAMS_CASE UNIQUE (CAMS_CASE_ID)
);

GO

-- Computed column for CASE_FULL_ACMS (matches ACMS pattern)
ALTER TABLE CMMAP_STAGING
ADD CASE_FULL_ACMS AS (
    RIGHT('000' + CAST(CASE_DIV AS VARCHAR), 3) + '-' +
    RIGHT('00' + CAST(CASE_YEAR AS VARCHAR), 2) + '-' +
    RIGHT('00000' + CAST(CASE_NUMBER AS VARCHAR), 5)
) PERSISTED;

GO

-- Index on source for efficient view queries
CREATE INDEX IX_CMMAP_STAGING_SOURCE ON CMMAP_STAGING(SOURCE);

GO

-- Index on active appointments
CREATE INDEX IX_CMMAP_STAGING_ACTIVE ON CMMAP_STAGING(APPTEE_ACTIVE, DELETE_CODE)
WHERE DELETE_CODE = ' ' AND APPTEE_ACTIVE = 'Y';

GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Staging table for CAMS Chapter 15 case assignments. Unioned with ACMS CMMAP in view.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'CMMAP_STAGING';

GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Original CAMS case ID (e.g., "081-24-12345") for traceability back to source system',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'CMMAP_STAGING',
    @level2type = N'COLUMN', @level2name = N'CAMS_CASE_ID';

GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Professional code placeholder. Mapping strategy TBD: "ZZ-{int}" or "{GROUP}-{int}"',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'CMMAP_STAGING',
    @level2type = N'COLUMN', @level2name = N'PROF_CODE';

GO
