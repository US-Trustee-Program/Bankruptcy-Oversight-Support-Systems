-- CMMAP_SYNC_CONTROL: Watermark state for the daily ACMS→CMMAP_ALL sync job
-- Lives in ACMS_REP_SUB alongside CMMAP, CMMAP_CAMS, and CMMAP_ALL.
--
-- One row per named sync process. The daily timer trigger reads LAST_SYNC_DATE
-- to build its CDB_UPDATE_DATE filter, then updates it after a successful run.

IF OBJECT_ID('dbo.CMMAP_SYNC_CONTROL', 'U') IS NOT NULL
    DROP TABLE dbo.CMMAP_SYNC_CONTROL;

GO

CREATE TABLE CMMAP_SYNC_CONTROL (
    -- Identifies the sync process (e.g., 'ACMS_DAILY')
    PROCESS_NAME VARCHAR(50) NOT NULL,

    -- Watermark: only CMMAP rows with CDB_UPDATE_DATE > this value are synced
    -- Initialized to a past date so the first run seeds all active appointments
    LAST_SYNC_DATE DATETIME2(3) NOT NULL DEFAULT '2000-01-01T00:00:00.000',

    -- Wall-clock timestamp of the last successful sync run
    LAST_RUN_AT DATETIME2(3) NULL,

    CONSTRAINT PK_CMMAP_SYNC_CONTROL PRIMARY KEY (PROCESS_NAME)
);

GO

-- Seed the single control row for the daily ACMS sync
INSERT INTO CMMAP_SYNC_CONTROL (PROCESS_NAME, LAST_SYNC_DATE, LAST_RUN_AT)
VALUES ('ACMS_DAILY', '2000-01-01T00:00:00.000', NULL);

GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Watermark state for daily ACMS→CMMAP_ALL sync. LAST_SYNC_DATE is compared against CMMAP.CDB_UPDATE_DATE to find changed rows. Updated after each successful sync run.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'CMMAP_SYNC_CONTROL';

GO
