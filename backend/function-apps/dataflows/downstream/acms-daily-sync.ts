import { app, InvocationContext } from '@azure/functions';
import * as sql from 'mssql';
import ModuleNames from '../module-names';
import { buildFunctionName } from '../dataflows-common';
import { deferClose } from '../../../lib/deferrable/defer-close';
import { serializeError } from './acms-cams-transition';

const MODULE_NAME = ModuleNames.ACMS_CAMS_TRANSITION_DAILY_SYNC;
const TIMER_TRIGGER = buildFunctionName(MODULE_NAME, 'timerTrigger');

// Default watermark used when CMMAP_SYNC_CONTROL has no row yet
const DEFAULT_WATERMARK = new Date('2000-01-01T00:00:00.000Z');

let connectionPool: sql.ConnectionPool | null = null;

function getConnectionPool(): sql.ConnectionPool {
  if (!connectionPool) {
    connectionPool = new sql.ConnectionPool({
      server: process.env.ACMS_MSSQL_HOST || '',
      database: process.env.ACMS_MSSQL_DATABASE || '',
      user: process.env.ACMS_MSSQL_USER,
      password: process.env.ACMS_MSSQL_PASS,
      options: {
        encrypt: process.env.ACMS_MSSQL_ENCRYPT !== 'false',
        trustServerCertificate: process.env.ACMS_MSSQL_TRUST_UNSIGNED_CERT === 'true',
      },
    });
    deferClose(connectionPool);
  }
  return connectionPool;
}

async function readWatermark(pool: sql.ConnectionPool): Promise<Date> {
  const request = pool.request();
  const result = await request.query(`
    SELECT LAST_SYNC_DATE
    FROM CMMAP_SYNC_CONTROL
    WHERE PROCESS_NAME = 'ACMS_DAILY'
  `);
  return result.recordset[0]?.LAST_SYNC_DATE ?? DEFAULT_WATERMARK;
}

async function updateWatermark(pool: sql.ConnectionPool, runAt: Date): Promise<void> {
  const request = pool.request();
  request.input('LAST_SYNC_DATE', sql.DateTime2(3), runAt);
  request.input('LAST_RUN_AT', sql.DateTime2(3), runAt);
  const result = await request.query(`
    UPDATE CMMAP_SYNC_CONTROL
    SET LAST_SYNC_DATE = @LAST_SYNC_DATE,
        LAST_RUN_AT = @LAST_RUN_AT
    WHERE PROCESS_NAME = 'ACMS_DAILY'
  `);
  if (result.rowsAffected[0] === 0) {
    throw new Error(
      "CMMAP_SYNC_CONTROL has no 'ACMS_DAILY' row — watermark not updated. " +
        'Re-run the migration to restore the control row.',
    );
  }
}

/**
 * Merges active ACMS appointments (and their immediate predecessors) into CMMAP_ALL.
 * Rows already owned by CAMS (SOURCE='CAMS') are never overwritten.
 * Runs as a single MERGE statement so the DB engine handles the upsert atomically.
 */
async function mergeCmmapRows(pool: sql.ConnectionPool, watermark: Date): Promise<number> {
  const request = pool.request();
  request.input('WATERMARK', sql.DateTime2(3), watermark);
  request.input('RUN_AT', sql.DateTime2(3), new Date());

  const result = await request.query(`
    MERGE INTO CMMAP_ALL AS target
    USING (
      -- Active appointments newer than watermark
      SELECT
        m.DELETE_CODE, m.CASE_DIV, m.CASE_YEAR, m.CASE_NUMBER, m.RECORD_SEQ_NBR,
        m.PROF_CODE, m.GROUP_DESIGNATOR, m.APPT_TYPE,
        m.APPT_DATE, m.APPT_DATE_DT,
        m.APPT_DISP, m.DISP_DATE, m.DISP_DATE_DT,
        m.COMMENTS, m.APPTEE_ACTIVE, m.ALPHA_SEARCH, m.USER_ID,
        m.HEARING_SEQUENCE, m.REGION_CODE,
        m.RGN_CREATE_DATE, m.RGN_UPDATE_DATE, m.RGN_CREATE_DATE_DT, m.RGN_UPDATE_DATE_DT,
        m.CDB_CREATE_DATE, m.CDB_UPDATE_DATE, m.CDB_CREATE_DATE_DT, m.CDB_UPDATE_DATE_DT,
        m.UPDATE_DATE, m.REPLICATED_DATE, m.id, m.RRN
      FROM dbo.CMMAP m
      WHERE m.APPTEE_ACTIVE = 'Y'
        AND m.DELETE_CODE = ' '
        AND m.CDB_UPDATE_DATE > CONVERT(NUMERIC(8,0),
              FORMAT(@WATERMARK, 'yyyyMMdd'))

      UNION ALL

      -- Immediate predecessor per (case, APPT_TYPE) for each active row above
      SELECT
        m.DELETE_CODE, m.CASE_DIV, m.CASE_YEAR, m.CASE_NUMBER, m.RECORD_SEQ_NBR,
        m.PROF_CODE, m.GROUP_DESIGNATOR, m.APPT_TYPE,
        m.APPT_DATE, m.APPT_DATE_DT,
        m.APPT_DISP, m.DISP_DATE, m.DISP_DATE_DT,
        m.COMMENTS, m.APPTEE_ACTIVE, m.ALPHA_SEARCH, m.USER_ID,
        m.HEARING_SEQUENCE, m.REGION_CODE,
        m.RGN_CREATE_DATE, m.RGN_UPDATE_DATE, m.RGN_CREATE_DATE_DT, m.RGN_UPDATE_DATE_DT,
        m.CDB_CREATE_DATE, m.CDB_UPDATE_DATE, m.CDB_CREATE_DATE_DT, m.CDB_UPDATE_DATE_DT,
        m.UPDATE_DATE, m.REPLICATED_DATE, m.id, m.RRN
      FROM dbo.CMMAP m
      INNER JOIN (
        SELECT
          CASE_DIV, CASE_YEAR, CASE_NUMBER, APPT_TYPE,
          MAX(RECORD_SEQ_NBR) AS MAX_SEQ
        FROM dbo.CMMAP
        WHERE APPTEE_ACTIVE = 'N' AND DELETE_CODE = ' '
        GROUP BY CASE_DIV, CASE_YEAR, CASE_NUMBER, APPT_TYPE
      ) pred
        ON m.CASE_DIV    = pred.CASE_DIV
       AND m.CASE_YEAR   = pred.CASE_YEAR
       AND m.CASE_NUMBER = pred.CASE_NUMBER
       AND m.APPT_TYPE   = pred.APPT_TYPE
       AND m.RECORD_SEQ_NBR = pred.MAX_SEQ
      WHERE EXISTS (
        SELECT 1 FROM dbo.CMMAP active
        WHERE active.CASE_DIV    = m.CASE_DIV
          AND active.CASE_YEAR   = m.CASE_YEAR
          AND active.CASE_NUMBER = m.CASE_NUMBER
          AND active.APPT_TYPE   = m.APPT_TYPE
          AND active.APPTEE_ACTIVE = 'Y'
          AND active.DELETE_CODE = ' '
          AND active.CDB_UPDATE_DATE > CONVERT(NUMERIC(8,0),
                FORMAT(@WATERMARK, 'yyyyMMdd'))
      )
    ) AS source (
      DELETE_CODE, CASE_DIV, CASE_YEAR, CASE_NUMBER, RECORD_SEQ_NBR,
      PROF_CODE, GROUP_DESIGNATOR, APPT_TYPE,
      APPT_DATE, APPT_DATE_DT,
      APPT_DISP, DISP_DATE, DISP_DATE_DT,
      COMMENTS, APPTEE_ACTIVE, ALPHA_SEARCH, USER_ID,
      HEARING_SEQUENCE, REGION_CODE,
      RGN_CREATE_DATE, RGN_UPDATE_DATE, RGN_CREATE_DATE_DT, RGN_UPDATE_DATE_DT,
      CDB_CREATE_DATE, CDB_UPDATE_DATE, CDB_CREATE_DATE_DT, CDB_UPDATE_DATE_DT,
      UPDATE_DATE, REPLICATED_DATE, id, RRN
    )
    ON target.CASE_DIV    = source.CASE_DIV
      AND target.CASE_YEAR   = source.CASE_YEAR
      AND target.CASE_NUMBER = source.CASE_NUMBER
      AND target.APPT_TYPE   = source.APPT_TYPE
      AND target.RECORD_SEQ_NBR = source.RECORD_SEQ_NBR
    -- CAMS-owned rows are never overwritten by ACMS sync
    WHEN MATCHED AND target.SOURCE != 'CAMS' THEN
      UPDATE SET
        DELETE_CODE        = source.DELETE_CODE,
        PROF_CODE          = source.PROF_CODE,
        GROUP_DESIGNATOR   = source.GROUP_DESIGNATOR,
        APPT_DATE          = source.APPT_DATE,
        APPT_DATE_DT       = source.APPT_DATE_DT,
        APPT_DISP          = source.APPT_DISP,
        DISP_DATE          = source.DISP_DATE,
        DISP_DATE_DT       = source.DISP_DATE_DT,
        COMMENTS           = source.COMMENTS,
        APPTEE_ACTIVE      = source.APPTEE_ACTIVE,
        ALPHA_SEARCH       = source.ALPHA_SEARCH,
        USER_ID            = source.USER_ID,
        HEARING_SEQUENCE   = source.HEARING_SEQUENCE,
        REGION_CODE        = source.REGION_CODE,
        RGN_CREATE_DATE    = source.RGN_CREATE_DATE,
        RGN_UPDATE_DATE    = source.RGN_UPDATE_DATE,
        RGN_CREATE_DATE_DT = source.RGN_CREATE_DATE_DT,
        RGN_UPDATE_DATE_DT = source.RGN_UPDATE_DATE_DT,
        CDB_CREATE_DATE    = source.CDB_CREATE_DATE,
        CDB_UPDATE_DATE    = source.CDB_UPDATE_DATE,
        CDB_CREATE_DATE_DT = source.CDB_CREATE_DATE_DT,
        CDB_UPDATE_DATE_DT = source.CDB_UPDATE_DATE_DT,
        UPDATE_DATE        = source.UPDATE_DATE,
        REPLICATED_DATE    = source.REPLICATED_DATE,
        LAST_UPDATED       = @RUN_AT
    WHEN NOT MATCHED BY TARGET THEN
      INSERT (
        DELETE_CODE,
        CASE_DIV, CASE_YEAR, CASE_NUMBER, APPT_TYPE, RECORD_SEQ_NBR,
        PROF_CODE, GROUP_DESIGNATOR,
        APPT_DATE, APPT_DATE_DT,
        APPT_DISP, DISP_DATE, DISP_DATE_DT,
        COMMENTS, APPTEE_ACTIVE, ALPHA_SEARCH, USER_ID,
        HEARING_SEQUENCE, REGION_CODE,
        RGN_CREATE_DATE, RGN_UPDATE_DATE, RGN_CREATE_DATE_DT, RGN_UPDATE_DATE_DT,
        CDB_CREATE_DATE, CDB_UPDATE_DATE, CDB_CREATE_DATE_DT, CDB_UPDATE_DATE_DT,
        UPDATE_DATE, REPLICATED_DATE, id, RRN,
        SOURCE, LAST_UPDATED
      )
      VALUES (
        source.DELETE_CODE,
        source.CASE_DIV, source.CASE_YEAR, source.CASE_NUMBER, source.APPT_TYPE, source.RECORD_SEQ_NBR,
        source.PROF_CODE, source.GROUP_DESIGNATOR,
        source.APPT_DATE, source.APPT_DATE_DT,
        source.APPT_DISP, source.DISP_DATE, source.DISP_DATE_DT,
        source.COMMENTS, source.APPTEE_ACTIVE, source.ALPHA_SEARCH, source.USER_ID,
        source.HEARING_SEQUENCE, source.REGION_CODE,
        source.RGN_CREATE_DATE, source.RGN_UPDATE_DATE, source.RGN_CREATE_DATE_DT, source.RGN_UPDATE_DATE_DT,
        source.CDB_CREATE_DATE, source.CDB_UPDATE_DATE, source.CDB_CREATE_DATE_DT, source.CDB_UPDATE_DATE_DT,
        source.UPDATE_DATE, source.REPLICATED_DATE, source.id, source.RRN,
        'ACMS', @RUN_AT
      );
  `);

  return result.rowsAffected?.[0] ?? 0;
}

async function syncAcmsToAll(context: InvocationContext): Promise<void> {
  const startTime = Date.now();
  const pool = getConnectionPool();
  if (!pool.connected) {
    await pool.connect();
  }

  try {
    const watermark = await readWatermark(pool);
    const rowsAffected = await mergeCmmapRows(pool, watermark);
    const runAt = new Date();
    await updateWatermark(pool, runAt);

    context.log({
      moduleName: MODULE_NAME,
      success: true,
      durationMs: Date.now() - startTime,
      rowsAffected,
      watermark: watermark.toISOString(),
    });
  } catch (error) {
    context.log({
      moduleName: MODULE_NAME,
      success: false,
      durationMs: Date.now() - startTime,
      error: serializeError(error),
    });
    throw error;
  }
}

function setup() {
  app.timer(TIMER_TRIGGER, {
    // Daily at 02:00 UTC — after ACMS replica refresh, before business hours
    schedule: '0 0 2 * * *',
    handler: (_timer, context) => syncAcmsToAll(context),
  });
}

export default {
  MODULE_NAME,
  setup,
  syncAcmsToAll,
};
