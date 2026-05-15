import { app, InvocationContext, output } from '@azure/functions';
import * as sql from 'mssql';
import { buildQueueName } from '@common/queues';
import {
  CaseAssignmentDownstreamEvent,
  TrusteeAppointmentDownstreamEvent,
} from '@common/cams/dataflow-events';

// ─── Row type ────────────────────────────────────────────────────────────────

export interface CmmapCamsRow {
  DELETE_CODE: string;
  CASE_DIV: number;
  CASE_YEAR: number;
  CASE_NUMBER: number;
  RECORD_SEQ_NBR: number;
  PROF_CODE: number;
  GROUP_DESIGNATOR: string;
  APPT_TYPE: string;
  APPT_DATE: number | null;
  APPT_DATE_DT: Date | null;
  APPT_DISP: string | null;
  DISP_DATE: number | null;
  DISP_DATE_DT: Date | null;
  COMMENTS: string | null;
  APPTEE_ACTIVE: string;
  ALPHA_SEARCH: string | null;
  USER_ID: string | null;
  HEARING_SEQUENCE: number | null;
  REGION_CODE: string | null;
  RGN_CREATE_DATE: number | null;
  RGN_UPDATE_DATE: number | null;
  RGN_CREATE_DATE_DT: Date | null;
  RGN_UPDATE_DATE_DT: Date | null;
  CDB_CREATE_DATE: number | null;
  CDB_UPDATE_DATE: number | null;
  CDB_CREATE_DATE_DT: Date | null;
  CDB_UPDATE_DATE_DT: Date | null;
  UPDATE_DATE: Date;
  SOURCE: string;
  CAMS_CASE_ID: string;
  CAMS_USER_ID: string;
  CAMS_USER_NAME: string;
  LAST_UPDATED: Date;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

export function parseCaseId(caseId: string): { div: number; year: number; number: number } {
  const match = caseId.match(/^(\d{3})-(\d{2})-(\d{5})$/);
  if (!match) {
    throw new Error(`Invalid CAMS case ID format: ${caseId}`);
  }
  return {
    div: parseInt(match[1], 10),
    year: parseInt(match[2], 10),
    number: parseInt(match[3], 10),
  };
}

// Convert ISO date string to ACMS positional integer date format (YYYYMMDD)
export function toAcmsDateNumeric(isoDateString: string): number {
  const datePortion = isoDateString.split('T')[0];
  return parseInt(datePortion.replace(/-/g, ''), 10);
}

// Parse "{GROUP_DESIGNATOR}-{PROF_CODE}" (e.g. "NY-00063") into components
export function parseProfessionalId(acmsProfessionalId: string): { group: string; code: number } {
  const dashIndex = acmsProfessionalId.indexOf('-');
  const group = acmsProfessionalId.slice(0, dashIndex);
  const code = parseInt(acmsProfessionalId.slice(dashIndex + 1), 10);
  return { group, code };
}

function getSqlConfig(): sql.config {
  return {
    server: process.env.ACMS_MSSQL_HOST || '',
    database: process.env.ACMS_MSSQL_DATABASE || '',
    user: process.env.ACMS_MSSQL_USER,
    password: process.env.ACMS_MSSQL_PASS,
    options: {
      encrypt: process.env.ACMS_MSSQL_ENCRYPT !== 'false',
      trustServerCertificate: process.env.ACMS_MSSQL_TRUST_UNSIGNED_CERT === 'true',
    },
  };
}

export async function upsertCmmapCamsRow(row: CmmapCamsRow, sqlConfig: sql.config): Promise<void> {
  const pool = await sql.connect(sqlConfig);
  const request = pool.request();

  const query = `
    MERGE INTO CMMAP_CAMS AS target
    USING (VALUES (
      @CASE_DIV,
      @CASE_YEAR,
      @CASE_NUMBER,
      @APPT_TYPE,
      @RECORD_SEQ_NBR
    )) AS source (CASE_DIV, CASE_YEAR, CASE_NUMBER, APPT_TYPE, RECORD_SEQ_NBR)
    ON target.CASE_DIV = source.CASE_DIV
      AND target.CASE_YEAR = source.CASE_YEAR
      AND target.CASE_NUMBER = source.CASE_NUMBER
      AND target.APPT_TYPE = source.APPT_TYPE
      AND target.RECORD_SEQ_NBR = source.RECORD_SEQ_NBR
    WHEN MATCHED THEN
      UPDATE SET
        DELETE_CODE = @DELETE_CODE,
        PROF_CODE = @PROF_CODE,
        GROUP_DESIGNATOR = @GROUP_DESIGNATOR,
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
        CASE_DIV, CASE_YEAR, CASE_NUMBER, APPT_TYPE, RECORD_SEQ_NBR,
        PROF_CODE, GROUP_DESIGNATOR,
        APPT_DATE, APPT_DATE_DT,
        APPT_DISP, DISP_DATE, DISP_DATE_DT,
        COMMENTS, APPTEE_ACTIVE, ALPHA_SEARCH, USER_ID,
        HEARING_SEQUENCE, REGION_CODE,
        RGN_CREATE_DATE, RGN_UPDATE_DATE, RGN_CREATE_DATE_DT, RGN_UPDATE_DATE_DT,
        CDB_CREATE_DATE, CDB_UPDATE_DATE, CDB_CREATE_DATE_DT, CDB_UPDATE_DATE_DT,
        UPDATE_DATE, SOURCE, CAMS_CASE_ID, CAMS_USER_ID, CAMS_USER_NAME, LAST_UPDATED
      )
      VALUES (
        @DELETE_CODE,
        @CASE_DIV, @CASE_YEAR, @CASE_NUMBER, @APPT_TYPE, @RECORD_SEQ_NBR,
        @PROF_CODE, @GROUP_DESIGNATOR,
        @APPT_DATE, @APPT_DATE_DT,
        @APPT_DISP, @DISP_DATE, @DISP_DATE_DT,
        @COMMENTS, @APPTEE_ACTIVE, @ALPHA_SEARCH, @USER_ID,
        @HEARING_SEQUENCE, @REGION_CODE,
        @RGN_CREATE_DATE, @RGN_UPDATE_DATE, @RGN_CREATE_DATE_DT, @RGN_UPDATE_DATE_DT,
        @CDB_CREATE_DATE, @CDB_UPDATE_DATE, @CDB_CREATE_DATE_DT, @CDB_UPDATE_DATE_DT,
        @UPDATE_DATE, @SOURCE, @CAMS_CASE_ID, @CAMS_USER_ID, @CAMS_USER_NAME, @LAST_UPDATED
      );
  `;

  request.input('DELETE_CODE', sql.Char(1), row.DELETE_CODE);
  request.input('CASE_DIV', sql.Numeric(3, 0), row.CASE_DIV);
  request.input('CASE_YEAR', sql.Numeric(2, 0), row.CASE_YEAR);
  request.input('CASE_NUMBER', sql.Numeric(5, 0), row.CASE_NUMBER);
  request.input('RECORD_SEQ_NBR', sql.Numeric(5, 0), row.RECORD_SEQ_NBR);
  request.input('PROF_CODE', sql.Numeric(5, 0), row.PROF_CODE);
  request.input('GROUP_DESIGNATOR', sql.Char(2), row.GROUP_DESIGNATOR);
  request.input('APPT_TYPE', sql.Char(2), row.APPT_TYPE);
  request.input('APPT_DATE', sql.Numeric(8, 0), row.APPT_DATE);
  request.input('APPT_DATE_DT', sql.DateTime2(3), row.APPT_DATE_DT);
  request.input('APPT_DISP', sql.Char(2), row.APPT_DISP);
  request.input('DISP_DATE', sql.Numeric(8, 0), row.DISP_DATE);
  request.input('DISP_DATE_DT', sql.DateTime2(3), row.DISP_DATE_DT);
  request.input('COMMENTS', sql.Char(30), row.COMMENTS);
  request.input('APPTEE_ACTIVE', sql.Char(1), row.APPTEE_ACTIVE);
  request.input('ALPHA_SEARCH', sql.Char(30), row.ALPHA_SEARCH);
  request.input('USER_ID', sql.Char(10), row.USER_ID);
  request.input('HEARING_SEQUENCE', sql.Numeric(5, 0), row.HEARING_SEQUENCE);
  request.input('REGION_CODE', sql.Char(2), row.REGION_CODE);
  request.input('RGN_CREATE_DATE', sql.Numeric(8, 0), row.RGN_CREATE_DATE);
  request.input('RGN_UPDATE_DATE', sql.Numeric(8, 0), row.RGN_UPDATE_DATE);
  request.input('RGN_CREATE_DATE_DT', sql.DateTime2(3), row.RGN_CREATE_DATE_DT);
  request.input('RGN_UPDATE_DATE_DT', sql.DateTime2(3), row.RGN_UPDATE_DATE_DT);
  request.input('CDB_CREATE_DATE', sql.Numeric(8, 0), row.CDB_CREATE_DATE);
  request.input('CDB_UPDATE_DATE', sql.Numeric(8, 0), row.CDB_UPDATE_DATE);
  request.input('CDB_CREATE_DATE_DT', sql.DateTime2(3), row.CDB_CREATE_DATE_DT);
  request.input('CDB_UPDATE_DATE_DT', sql.DateTime2(3), row.CDB_UPDATE_DATE_DT);
  request.input('UPDATE_DATE', sql.DateTime2(3), row.UPDATE_DATE);
  request.input('SOURCE', sql.VarChar(10), row.SOURCE);
  request.input('CAMS_CASE_ID', sql.VarChar(50), row.CAMS_CASE_ID);
  request.input('CAMS_USER_ID', sql.VarChar(50), row.CAMS_USER_ID);
  request.input('CAMS_USER_NAME', sql.VarChar(100), row.CAMS_USER_NAME);
  request.input('LAST_UPDATED', sql.DateTime2, row.LAST_UPDATED);

  try {
    await request.query(query);
  } finally {
    await pool.close();
  }
}

// ─── Staff assignment handler ─────────────────────────────────────────────────

const STAFF_MODULE_NAME = 'DOWNSTREAM-STAFF-ASSIGNMENTS';
const STAFF_QUEUE_NAME = buildQueueName('CASE-ASSIGNMENT-EVENT');

const STAFF_DLQ = output.storageQueue({
  queueName: buildQueueName(STAFF_MODULE_NAME, 'DLQ'),
  connection: 'DataflowsStorage',
});

export function extractLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1].toUpperCase();
}

export function transformStaffAssignmentToRow(event: CaseAssignmentDownstreamEvent): CmmapCamsRow {
  if (!event.acmsProfessionalId) {
    throw new Error(
      `Cannot transform event: acmsProfessionalId is null for caseId ${event.caseId}`,
    );
  }

  const { div, year, number } = parseCaseId(event.caseId);
  const { group, code } = parseProfessionalId(event.acmsProfessionalId);
  const now = new Date();

  const isUnassigned = !!event.unassignedOn;
  const apptDate = toAcmsDateNumeric(event.assignedOn);
  const dispDate = isUnassigned ? toAcmsDateNumeric(event.unassignedOn!) : null;

  return {
    DELETE_CODE: ' ',
    CASE_DIV: div,
    CASE_YEAR: year,
    CASE_NUMBER: number,
    // CAMS represents one staff attorney per case (S1 slot); RECORD_SEQ_NBR=1 is intentional
    RECORD_SEQ_NBR: 1,
    PROF_CODE: code,
    GROUP_DESIGNATOR: group,
    APPT_TYPE: 'S1',
    APPT_DATE: apptDate,
    APPT_DATE_DT: new Date(event.assignedOn),
    APPT_DISP: isUnassigned ? 'WD' : 'AP',
    DISP_DATE: dispDate,
    DISP_DATE_DT: isUnassigned ? new Date(event.unassignedOn!) : null,
    COMMENTS: null,
    APPTEE_ACTIVE: isUnassigned ? 'N' : 'Y',
    ALPHA_SEARCH: extractLastName(event.name),
    USER_ID: 'CAMS',
    HEARING_SEQUENCE: null,
    REGION_CODE: null,
    RGN_CREATE_DATE: null,
    RGN_UPDATE_DATE: null,
    RGN_CREATE_DATE_DT: null,
    RGN_UPDATE_DATE_DT: null,
    CDB_CREATE_DATE: toAcmsDateNumeric(now.toISOString()),
    CDB_UPDATE_DATE: toAcmsDateNumeric(now.toISOString()),
    CDB_CREATE_DATE_DT: now,
    CDB_UPDATE_DATE_DT: now,
    UPDATE_DATE: now,
    SOURCE: 'CAMS',
    CAMS_CASE_ID: event.caseId,
    CAMS_USER_ID: event.userId,
    CAMS_USER_NAME: event.name,
    LAST_UPDATED: now,
  };
}

async function staffAssignmentHandler(
  queueItem: unknown,
  context: InvocationContext,
): Promise<void> {
  const startTime = Date.now();

  try {
    const event = typeof queueItem === 'string' ? JSON.parse(queueItem) : queueItem;
    const assignmentEvent = event as CaseAssignmentDownstreamEvent;

    if (
      !assignmentEvent.caseId ||
      !assignmentEvent.userId ||
      !assignmentEvent.name ||
      !assignmentEvent.assignedOn
    ) {
      throw new Error('Invalid assignment event: missing required fields');
    }

    const row = transformStaffAssignmentToRow(assignmentEvent);
    await upsertCmmapCamsRow(row, getSqlConfig());

    context.log({
      moduleName: STAFF_MODULE_NAME,
      handlerName: 'staffAssignmentHandler',
      success: true,
      durationMs: Date.now() - startTime,
      documentsWritten: 1,
      documentsFailed: 0,
      caseId: assignmentEvent.caseId,
    });
  } catch (error) {
    context.log({
      moduleName: STAFF_MODULE_NAME,
      handlerName: 'staffAssignmentHandler',
      success: false,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    });
    context.extraOutputs.set(STAFF_DLQ, {
      type: 'QUEUE_ERROR',
      module: STAFF_MODULE_NAME,
      activityName: 'staffAssignmentHandler',
      error,
    });
  }
}

app.storageQueue('staff-assignment-handler', {
  queueName: STAFF_QUEUE_NAME,
  connection: 'DataflowsStorage',
  extraOutputs: [STAFF_DLQ],
  handler: staffAssignmentHandler,
});

// ─── Trustee appointment handler ──────────────────────────────────────────────

const TRUSTEE_MODULE_NAME = 'TRUSTEE-APPOINTMENT-HANDLER';
const TRUSTEE_QUEUE_NAME = buildQueueName('TRUSTEE-APPOINTMENT-EVENT');

const TRUSTEE_DLQ = output.storageQueue({
  queueName: buildQueueName('TRUSTEE-APPOINTMENT-EVENT', 'DLQ'),
  connection: 'DataflowsStorage',
});

export function transformTrusteeAppointmentToRow(
  event: TrusteeAppointmentDownstreamEvent,
): CmmapCamsRow {
  const { div, year, number } = parseCaseId(event.caseId);
  const { group, code } = parseProfessionalId(event.acmsProfessionalId);
  const now = new Date();

  const isUnassigned = !!event.unassignedOn;
  const apptDateSource = event.appointedDate ?? event.assignedOn;
  const apptDate = toAcmsDateNumeric(apptDateSource);
  const dispDate = isUnassigned ? toAcmsDateNumeric(event.unassignedOn!) : null;

  return {
    DELETE_CODE: ' ',
    CASE_DIV: div,
    CASE_YEAR: year,
    CASE_NUMBER: number,
    // CAMS represents one trustee appointment per case (TR slot); RECORD_SEQ_NBR=1 is intentional
    RECORD_SEQ_NBR: 1,
    PROF_CODE: code,
    GROUP_DESIGNATOR: group,
    APPT_TYPE: 'TR',
    APPT_DATE: apptDate,
    APPT_DATE_DT: new Date(apptDateSource),
    APPT_DISP: isUnassigned ? 'WD' : 'GR',
    DISP_DATE: dispDate,
    DISP_DATE_DT: isUnassigned ? new Date(event.unassignedOn!) : null,
    COMMENTS: null,
    APPTEE_ACTIVE: isUnassigned ? 'N' : 'Y',
    ALPHA_SEARCH: null,
    USER_ID: 'CAMS',
    HEARING_SEQUENCE: null,
    REGION_CODE: null,
    RGN_CREATE_DATE: null,
    RGN_UPDATE_DATE: null,
    RGN_CREATE_DATE_DT: null,
    RGN_UPDATE_DATE_DT: null,
    CDB_CREATE_DATE: toAcmsDateNumeric(now.toISOString()),
    CDB_UPDATE_DATE: toAcmsDateNumeric(now.toISOString()),
    CDB_CREATE_DATE_DT: now,
    CDB_UPDATE_DATE_DT: now,
    UPDATE_DATE: now,
    SOURCE: 'CAMS',
    CAMS_CASE_ID: event.caseId,
    CAMS_USER_ID: 'CAMS',
    CAMS_USER_NAME: 'CAMS',
    LAST_UPDATED: now,
  };
}

async function trusteeAppointmentHandler(
  queueItem: unknown,
  context: InvocationContext,
): Promise<void> {
  const startTime = Date.now();

  try {
    const event = typeof queueItem === 'string' ? JSON.parse(queueItem) : queueItem;
    const appointmentEvent = event as TrusteeAppointmentDownstreamEvent;

    if (
      !appointmentEvent.caseId ||
      !appointmentEvent.acmsProfessionalId ||
      !appointmentEvent.trusteeId ||
      !appointmentEvent.assignedOn
    ) {
      throw new Error('Invalid trustee appointment event: missing required fields');
    }

    const row = transformTrusteeAppointmentToRow(appointmentEvent);
    await upsertCmmapCamsRow(row, getSqlConfig());

    context.log({
      moduleName: TRUSTEE_MODULE_NAME,
      handlerName: 'trusteeAppointmentHandler',
      success: true,
      durationMs: Date.now() - startTime,
      documentsWritten: 1,
      documentsFailed: 0,
      caseId: appointmentEvent.caseId,
    });
  } catch (error) {
    context.log({
      moduleName: TRUSTEE_MODULE_NAME,
      handlerName: 'trusteeAppointmentHandler',
      success: false,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    });
    context.extraOutputs.set(TRUSTEE_DLQ, {
      type: 'QUEUE_ERROR',
      module: TRUSTEE_MODULE_NAME,
      activityName: 'trusteeAppointmentHandler',
      error,
    });
  }
}

app.storageQueue('trustee-appointment-handler', {
  queueName: TRUSTEE_QUEUE_NAME,
  connection: 'DataflowsStorage',
  extraOutputs: [TRUSTEE_DLQ],
  handler: trusteeAppointmentHandler,
});
