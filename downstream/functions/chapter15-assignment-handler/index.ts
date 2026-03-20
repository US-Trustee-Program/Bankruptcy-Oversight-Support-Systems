import { app, InvocationContext } from '@azure/functions';
import * as sql from 'mssql';
import { buildQueueName } from '@common/cams';
import { transformToStagingRow, CaseAssignmentEvent, CmmapStagingRow } from './transform';

const MODULE_NAME = 'DOWNSTREAM-CHAPTER15-ASSIGNMENTS';
const CONNECTION_STRING = process.env.DOWNSTREAM_SQL_CONNECTION_STRING || '';
const QUEUE_NAME = buildQueueName(MODULE_NAME, 'event'); // downstream-chapter15-assignments-event

/**
 * Upsert a case assignment into CMMAP_STAGING table
 * Uses MERGE statement for idempotent upserts
 */
async function upsertAssignment(row: CmmapStagingRow): Promise<void> {
  const pool = await sql.connect(CONNECTION_STRING);

  try {
    const request = pool.request();

    // Use MERGE for upsert (idempotent)
    const query = `
      MERGE INTO CMMAP_STAGING AS target
      USING (VALUES (
        @CASE_DIV,
        @CASE_YEAR,
        @CASE_NUMBER,
        @RECORD_SEQ_NBR
      )) AS source (CASE_DIV, CASE_YEAR, CASE_NUMBER, RECORD_SEQ_NBR)
      ON target.CASE_DIV = source.CASE_DIV
        AND target.CASE_YEAR = source.CASE_YEAR
        AND target.CASE_NUMBER = source.CASE_NUMBER
        AND target.RECORD_SEQ_NBR = source.RECORD_SEQ_NBR
      WHEN MATCHED THEN
        UPDATE SET
          DELETE_CODE = @DELETE_CODE,
          PROF_CODE = @PROF_CODE,
          GROUP_DESIGNATOR = @GROUP_DESIGNATOR,
          APPT_TYPE = @APPT_TYPE,
          APPT_DATE = @APPT_DATE,
          APPT_DATE_DT = @APPT_DATE_DT,
          APPT_DISP = @APPT_DISP,
          DISP_DATE = @DISP_DATE,
          DISP_DATE_DT = @DISP_DATE_DT,
          APPTEE_ACTIVE = @APPTEE_ACTIVE,
          ALPHA_SEARCH = @ALPHA_SEARCH,
          UPDATE_DATE = @UPDATE_DATE,
          CAMS_USER_ID = @CAMS_USER_ID,
          CAMS_USER_NAME = @CAMS_USER_NAME,
          LAST_UPDATED = @LAST_UPDATED
      WHEN NOT MATCHED THEN
        INSERT (
          DELETE_CODE,
          CASE_DIV,
          CASE_YEAR,
          CASE_NUMBER,
          RECORD_SEQ_NBR,
          PROF_CODE,
          GROUP_DESIGNATOR,
          APPT_TYPE,
          APPT_DATE,
          APPT_DATE_DT,
          APPT_DISP,
          DISP_DATE,
          DISP_DATE_DT,
          COMMENTS,
          APPTEE_ACTIVE,
          ALPHA_SEARCH,
          USER_ID,
          HEARING_SEQUENCE,
          REGION_CODE,
          RGN_CREATE_DATE,
          RGN_UPDATE_DATE,
          RGN_CREATE_DATE_DT,
          RGN_UPDATE_DATE_DT,
          CDB_CREATE_DATE,
          CDB_UPDATE_DATE,
          CDB_CREATE_DATE_DT,
          CDB_UPDATE_DATE_DT,
          UPDATE_DATE,
          SOURCE,
          CAMS_CASE_ID,
          CAMS_USER_ID,
          CAMS_USER_NAME,
          LAST_UPDATED
        )
        VALUES (
          @DELETE_CODE,
          @CASE_DIV,
          @CASE_YEAR,
          @CASE_NUMBER,
          @RECORD_SEQ_NBR,
          @PROF_CODE,
          @GROUP_DESIGNATOR,
          @APPT_TYPE,
          @APPT_DATE,
          @APPT_DATE_DT,
          @APPT_DISP,
          @DISP_DATE,
          @DISP_DATE_DT,
          @COMMENTS,
          @APPTEE_ACTIVE,
          @ALPHA_SEARCH,
          @USER_ID,
          @HEARING_SEQUENCE,
          @REGION_CODE,
          @RGN_CREATE_DATE,
          @RGN_UPDATE_DATE,
          @RGN_CREATE_DATE_DT,
          @RGN_UPDATE_DATE_DT,
          @CDB_CREATE_DATE,
          @CDB_UPDATE_DATE,
          @CDB_CREATE_DATE_DT,
          @CDB_UPDATE_DATE_DT,
          @UPDATE_DATE,
          @SOURCE,
          @CAMS_CASE_ID,
          @CAMS_USER_ID,
          @CAMS_USER_NAME,
          @LAST_UPDATED
        );
    `;

    // Bind parameters
    request.input('DELETE_CODE', sql.Char(1), row.DELETE_CODE);
    request.input('CASE_DIV', sql.Numeric(5, 3), row.CASE_DIV);
    request.input('CASE_YEAR', sql.Numeric(5, 2), row.CASE_YEAR);
    request.input('CASE_NUMBER', sql.Numeric(5, 5), row.CASE_NUMBER);
    request.input('RECORD_SEQ_NBR', sql.Numeric(5, 5), row.RECORD_SEQ_NBR);
    request.input('PROF_CODE', sql.Numeric(5, 5), row.PROF_CODE);
    request.input('GROUP_DESIGNATOR', sql.Char(2), row.GROUP_DESIGNATOR);
    request.input('APPT_TYPE', sql.Char(2), row.APPT_TYPE);
    request.input('APPT_DATE', sql.Numeric(9, 11), row.APPT_DATE);
    request.input('APPT_DATE_DT', sql.DateTime2(3), row.APPT_DATE_DT);
    request.input('APPT_DISP', sql.Char(2), row.APPT_DISP);
    request.input('DISP_DATE', sql.Numeric(9, 11), row.DISP_DATE);
    request.input('DISP_DATE_DT', sql.DateTime2(3), row.DISP_DATE_DT);
    request.input('COMMENTS', sql.Char(30), row.COMMENTS);
    request.input('APPTEE_ACTIVE', sql.Char(1), row.APPTEE_ACTIVE);
    request.input('ALPHA_SEARCH', sql.Char(30), row.ALPHA_SEARCH);
    request.input('USER_ID', sql.Char(10), row.USER_ID);
    request.input('HEARING_SEQUENCE', sql.Numeric(5, 5), row.HEARING_SEQUENCE);
    request.input('REGION_CODE', sql.Char(2), row.REGION_CODE);
    request.input('RGN_CREATE_DATE', sql.Numeric(5, 8), row.RGN_CREATE_DATE);
    request.input('RGN_UPDATE_DATE', sql.Numeric(5, 8), row.RGN_UPDATE_DATE);
    request.input('RGN_CREATE_DATE_DT', sql.DateTime2(3), row.RGN_CREATE_DATE_DT);
    request.input('RGN_UPDATE_DATE_DT', sql.DateTime2(3), row.RGN_UPDATE_DATE_DT);
    request.input('CDB_CREATE_DATE', sql.Numeric(5, 8), row.CDB_CREATE_DATE);
    request.input('CDB_UPDATE_DATE', sql.Numeric(5, 8), row.CDB_UPDATE_DATE);
    request.input('CDB_CREATE_DATE_DT', sql.DateTime2(3), row.CDB_CREATE_DATE_DT);
    request.input('CDB_UPDATE_DATE_DT', sql.DateTime2(3), row.CDB_UPDATE_DATE_DT);
    request.input('UPDATE_DATE', sql.DateTime2(3), row.UPDATE_DATE);
    request.input('SOURCE', sql.VarChar(10), row.SOURCE);
    request.input('CAMS_CASE_ID', sql.VarChar(50), row.CAMS_CASE_ID);
    request.input('CAMS_USER_ID', sql.VarChar(50), row.CAMS_USER_ID);
    request.input('CAMS_USER_NAME', sql.VarChar(100), row.CAMS_USER_NAME);
    request.input('LAST_UPDATED', sql.DateTime2, row.LAST_UPDATED);

    await request.query(query);
  } finally {
    await pool.close();
  }
}

/**
 * Azure Function handler for Chapter 15 assignment events
 * Triggered by messages on 'chapter15-assignments' queue
 */
async function chapter15AssignmentHandler(
  queueItem: unknown,
  context: InvocationContext,
): Promise<void> {
  context.log('Chapter 15 assignment event received:', queueItem);

  try {
    // Parse queue message
    const event = typeof queueItem === 'string' ? JSON.parse(queueItem) : queueItem;
    const assignmentEvent = event as CaseAssignmentEvent;

    // Validate event
    if (!assignmentEvent.caseId || !assignmentEvent.userId || !assignmentEvent.name) {
      throw new Error('Invalid assignment event: missing required fields');
    }

    // Transform to ACMS format
    const stagingRow = transformToStagingRow(assignmentEvent);

    context.log('Transformed to staging row:', {
      caseId: stagingRow.CAMS_CASE_ID,
      userName: stagingRow.CAMS_USER_NAME,
      profCode: `${stagingRow.GROUP_DESIGNATOR}-${stagingRow.PROF_CODE}`,
      active: stagingRow.APPTEE_ACTIVE,
    });

    // Upsert to database
    await upsertAssignment(stagingRow);

    context.log('Successfully upserted assignment to CMMAP_STAGING');
  } catch (error) {
    context.error('Error processing assignment event:', error);
    throw error; // Re-throw to trigger retry/DLQ
  }
}

// Register function
app.storageQueue('chapter15-assignment-handler', {
  queueName: QUEUE_NAME, // downstream-chapter15-assignments-event
  connection: 'AzureWebJobsStorage',
  handler: chapter15AssignmentHandler,
});
