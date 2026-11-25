-- TOD (ATS) tables the trustee data report reads, with only the columns it reads:
-- TRUSTEE_COLUMNS and APPOINTMENT_COLUMNS in backend/lib/adapters/gateways/ats/ats.gateway.ts.
-- Runs against the ATS_INT database, which the harness creates first. Drops and recreates the
-- tables so a column change here always takes effect; seed-sql reloads the rows.

-- Left behind if a run is killed while L5 has TRUSTEES renamed; the next L5 rename would fail.
DROP TABLE IF EXISTS TRUSTEES_HIDDEN
GO

DROP TABLE IF EXISTS TRUSTEES
GO

CREATE TABLE TRUSTEES (
    ID             INT          NOT NULL PRIMARY KEY,
    LAST_NAME      VARCHAR(50)  NULL,
    FIRST_NAME     VARCHAR(50)  NULL,
    MIDDLE         VARCHAR(50)  NULL,
    COMPANY        VARCHAR(100) NULL,
    STREET         VARCHAR(100) NULL,
    STREET1        VARCHAR(100) NULL,
    CITY           VARCHAR(50)  NULL,
    STATE          CHAR(2)      NULL,
    ZIP            VARCHAR(10)  NULL,
    ZIP_PLUS       VARCHAR(5)   NULL,
    DISP_ON_WEB    CHAR(1)      NULL,
    DISP_ON_WEB_A2 CHAR(1)      NULL,
    STREET_A2      VARCHAR(100) NULL,
    STREET1_A2     VARCHAR(100) NULL,
    CITY_A2        VARCHAR(50)  NULL,
    STATE_A2       CHAR(2)      NULL,
    ZIP_A2         VARCHAR(10)  NULL,
    ZIP_PLUS_A2    VARCHAR(5)   NULL,
    TELEPHONE      VARCHAR(30)  NULL,
    EMAIL_ADDRESS  VARCHAR(100) NULL
  )
GO

DROP TABLE IF EXISTS CHAPTER_DETAILS
GO

CREATE TABLE CHAPTER_DETAILS (
    TRU_ID          INT         NOT NULL,
    DISTRICT        VARCHAR(50) NULL,
    SERVING_STATE   VARCHAR(50) NULL,
    CHAPTER         VARCHAR(10) NULL, -- some statuses are active only on one chapter, e.g. '2' on 12CBC
    APPOINTED_DATE  DATE        NULL,
    STATUS          VARCHAR(5)  NULL,
    STATUS_EFF_DATE DATE        NULL,
    ARCHIVE_DATE    DATE        NULL
  )
GO
