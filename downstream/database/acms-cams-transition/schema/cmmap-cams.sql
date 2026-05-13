-- CMMAP_CAMS: CAMS-sourced case assignments and trustee appointments
-- Matches ACMS CMMAP schema for use by downstream consumers (TUFR, Business Objects)
-- Sources:
--   APPT_TYPE='S1' — Ch15 staff attorney assignments (CaseAssignmentEvent)
--   APPT_TYPE='TR' — Trustee appointments, all chapters (TrusteeAppointmentDownstreamEvent)

IF OBJECT_ID('dbo.CMMAP_CAMS', 'U') IS NOT NULL
    DROP TABLE dbo.CMMAP_CAMS;

GO

CREATE TABLE CMMAP_CAMS (
    -- Soft delete flag (ACMS pattern)
    DELETE_CODE CHAR(1) NOT NULL DEFAULT ' ',

    -- Case identifiers (part of primary key)
    CASE_DIV NUMERIC(3,0) NOT NULL,
    CASE_YEAR NUMERIC(2,0) NOT NULL,
    CASE_NUMBER NUMERIC(5,0) NOT NULL,

    -- Record sequence (for multiple appointments of the same type per case)
    RECORD_SEQ_NBR NUMERIC(5,0) NOT NULL DEFAULT 1,

    -- Appointment type (part of primary key — required, no default)
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
    -- Active:     'AP' (Approved by UST) for S1; 'GR' (Granted by Court) for TR
    -- Terminated: 'WD' (Withdrawn)
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
    UPDATE_DATE DATETIME2(3) NOT NULL DEFAULT GETDATE(),

    -- CAMS-specific metadata (not in ACMS CMMAP)
    SOURCE VARCHAR(10) NOT NULL DEFAULT 'CAMS',
    CAMS_CASE_ID VARCHAR(50) NOT NULL,
    CAMS_USER_ID VARCHAR(50) NOT NULL,
    CAMS_USER_NAME VARCHAR(100) NOT NULL,
    LAST_UPDATED DATETIME2 NOT NULL DEFAULT GETDATE(),

    -- Primary key: one row per case + appointment type + sequence
    -- APPT_TYPE added so S1 and TR rows for the same case can coexist
    CONSTRAINT PK_CMMAP_CAMS PRIMARY KEY (CASE_DIV, CASE_YEAR, CASE_NUMBER, APPT_TYPE, RECORD_SEQ_NBR),

    -- One professional per case per appointment type
    CONSTRAINT UQ_CMMAP_CAMS_PROF UNIQUE (PROF_CODE, GROUP_DESIGNATOR, CASE_DIV, CASE_YEAR, CASE_NUMBER, APPT_TYPE),

    -- One CAMS case ID per appointment type (a case can have both S1 and TR rows)
    CONSTRAINT UQ_CMMAP_CAMS_CAMS_CASE UNIQUE (CAMS_CASE_ID, APPT_TYPE)
);

GO

-- Computed column for CASE_FULL_ACMS (matches ACMS pattern)
ALTER TABLE CMMAP_CAMS
ADD CASE_FULL_ACMS AS (
    RIGHT('000' + CAST(CASE_DIV AS VARCHAR), 3) + '-' +
    RIGHT('00' + CAST(CASE_YEAR AS VARCHAR), 2) + '-' +
    RIGHT('00000' + CAST(CASE_NUMBER AS VARCHAR), 5)
) PERSISTED;

GO

CREATE INDEX IX_CMMAP_CAMS_SOURCE ON CMMAP_CAMS(SOURCE);

GO

CREATE INDEX IX_CMMAP_CAMS_ACTIVE ON CMMAP_CAMS(APPTEE_ACTIVE, DELETE_CODE)
WHERE DELETE_CODE = ' ' AND APPTEE_ACTIVE = 'Y';

GO

CREATE INDEX IX_CMMAP_CAMS_APPT_TYPE ON CMMAP_CAMS(APPT_TYPE);

GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'CAMS-sourced case assignments (S1) and trustee appointments (TR). Unioned with ACMS CMMAP in CMMAP_ALL view.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'CMMAP_CAMS';

GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Appointment type. S1=Ch15 staff attorney, TR=Trustee (all chapters). Required — no default.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'CMMAP_CAMS',
    @level2type = N'COLUMN', @level2name = N'APPT_TYPE';

GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Original CAMS case ID (e.g., "081-24-12345") for traceability back to source system',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'CMMAP_CAMS',
    @level2type = N'COLUMN', @level2name = N'CAMS_CASE_ID';

GO
