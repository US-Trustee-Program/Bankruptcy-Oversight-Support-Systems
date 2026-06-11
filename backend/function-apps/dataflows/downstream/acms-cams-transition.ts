import { app, InvocationContext, StorageQueueOutput } from '@azure/functions';
import * as sql from 'mssql';
import {
  CaseAssignmentDownstreamEvent,
  TrusteeAppointmentDownstreamEvent,
} from '@common/cams/dataflow-events';
import ModuleNames from '../module-names';
import { buildFunctionName } from '../dataflows-common';
import ContextCreator from '../../azure/application-context-creator';
import { ApplicationContext } from '../../../lib/adapters/types/basic';
import { AbstractMssqlClient } from '../../../lib/adapters/gateways/abstract-mssql-client';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';

// ─── Row type ────────────────────────────────────────────────────────────────

interface CmmapCamsRow {
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

/** Parses a CAMS case ID (e.g. "081-24-12345") into its numeric ACMS components. */
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

/** Converts an ISO date string to the ACMS positional integer date format (YYYYMMDD). */
export function toAcmsDateNumeric(isoDateString: string): number {
  const datePortion = isoDateString.split('T')[0];
  return parseInt(datePortion.replace(/-/g, ''), 10);
}

/** Parses an ACMS professional ID (e.g. "NY-00063") into GROUP_DESIGNATOR and PROF_CODE. */
function parseProfessionalId(acmsProfessionalId: string): { group: string; code: number } {
  const dashIndex = acmsProfessionalId.indexOf('-');
  if (dashIndex === -1) {
    throw new Error(`Invalid acmsProfessionalId format: "${acmsProfessionalId}"`);
  }
  const group = acmsProfessionalId.slice(0, dashIndex);
  const code = parseInt(acmsProfessionalId.slice(dashIndex + 1), 10);
  return { group, code };
}

/**
 * Builds the invariant fields shared by both appointment types.
 * acmsProfessionalId must be non-null; callers are responsible for ensuring a valid
 * ACMS professional ID is available before calling this function.
 */
function buildBaseCmmapRow(
  caseId: string,
  acmsProfessionalId: string,
  userId: string,
  userName: string,
): Pick<
  CmmapCamsRow,
  | 'DELETE_CODE'
  | 'CASE_DIV'
  | 'CASE_YEAR'
  | 'CASE_NUMBER'
  | 'PROF_CODE'
  | 'GROUP_DESIGNATOR'
  | 'COMMENTS'
  | 'USER_ID'
  | 'HEARING_SEQUENCE'
  | 'REGION_CODE'
  | 'RGN_CREATE_DATE'
  | 'RGN_UPDATE_DATE'
  | 'RGN_CREATE_DATE_DT'
  | 'RGN_UPDATE_DATE_DT'
  | 'CDB_CREATE_DATE'
  | 'CDB_UPDATE_DATE'
  | 'CDB_CREATE_DATE_DT'
  | 'CDB_UPDATE_DATE_DT'
  | 'UPDATE_DATE'
  | 'SOURCE'
  | 'CAMS_CASE_ID'
  | 'CAMS_USER_ID'
  | 'CAMS_USER_NAME'
  | 'LAST_UPDATED'
> {
  const { div, year, number } = parseCaseId(caseId);
  const { group, code } = parseProfessionalId(acmsProfessionalId);
  const now = new Date();
  const nowIso = now.toISOString();
  return {
    DELETE_CODE: ' ',
    CASE_DIV: div,
    CASE_YEAR: year,
    CASE_NUMBER: number,
    PROF_CODE: code,
    GROUP_DESIGNATOR: group,
    COMMENTS: null,
    USER_ID: 'CAMS',
    HEARING_SEQUENCE: null,
    REGION_CODE: null,
    RGN_CREATE_DATE: null,
    RGN_UPDATE_DATE: null,
    RGN_CREATE_DATE_DT: null,
    RGN_UPDATE_DATE_DT: null,
    CDB_CREATE_DATE: toAcmsDateNumeric(nowIso),
    CDB_UPDATE_DATE: toAcmsDateNumeric(nowIso),
    CDB_CREATE_DATE_DT: now,
    CDB_UPDATE_DATE_DT: now,
    UPDATE_DATE: now,
    SOURCE: 'CAMS',
    CAMS_CASE_ID: caseId,
    CAMS_USER_ID: userId,
    CAMS_USER_NAME: userName,
    LAST_UPDATED: now,
  };
}

class AcmsRepSubClient extends AbstractMssqlClient {
  constructor(context: ApplicationContext) {
    super(context.config.acmsDbConfig, 'ACMS-REP-SUB');
  }
}

const ALLOWED_MERGE_TABLES = ['CMMAP_CAMS', 'CMMAP_ALL'] as const;

export function buildMergeQuery(tableName: 'CMMAP_CAMS' | 'CMMAP_ALL'): string {
  if (!(ALLOWED_MERGE_TABLES as readonly string[]).includes(tableName)) {
    throw new Error(`buildMergeQuery: illegal tableName '${tableName}'`);
  }
  // CMMAP_CAMS carries CAMS-specific metadata columns; CMMAP_ALL uses the ACMS schema shape.
  const isCams = tableName === 'CMMAP_CAMS';
  const updateCamsColumns = isCams
    ? `CAMS_USER_ID = @CAMS_USER_ID,
        CAMS_USER_NAME = @CAMS_USER_NAME,`
    : '';
  const insertColumns = isCams
    ? `UPDATE_DATE, SOURCE, CAMS_CASE_ID, CAMS_USER_ID, CAMS_USER_NAME, LAST_UPDATED`
    : `UPDATE_DATE, SOURCE, LAST_UPDATED`;
  const insertValues = isCams
    ? `@UPDATE_DATE, @SOURCE, @CAMS_CASE_ID, @CAMS_USER_ID, @CAMS_USER_NAME, @LAST_UPDATED`
    : `@UPDATE_DATE, @SOURCE, @LAST_UPDATED`;

  return `
    MERGE INTO ${tableName} AS target
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
    WHEN MATCHED AND @LAST_UPDATED > target.LAST_UPDATED THEN
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
        SOURCE = @SOURCE,
        ${updateCamsColumns}
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
        ${insertColumns}
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
        ${insertValues}
      );
  `;
}

function bindRowParams(request: sql.Request, row: CmmapCamsRow): void {
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
  request.input('LAST_UPDATED', sql.DateTime2(3), row.LAST_UPDATED);
}

async function upsertCmmapCamsRow(context: ApplicationContext, row: CmmapCamsRow): Promise<void> {
  const client = new AcmsRepSubClient(context);
  await client.withTransaction(context, async (tx) => {
    const camsRequest = tx.request();
    bindRowParams(camsRequest, row);
    await camsRequest.query(buildMergeQuery('CMMAP_CAMS'));

    const allRequest = tx.request();
    bindRowParams(allRequest, row);
    await allRequest.query(buildMergeQuery('CMMAP_ALL'));
  });
}

/** Serializes an error into a plain object safe for JSON transport. */
export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { raw: String(error) };
}

/**
 * Marks validation errors that will never succeed on retry so the handler
 * can route them straight to the DLQ without consuming retry attempts.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Wraps a queue handler with structured logging and selective DLQ routing.
 *
 * ValidationErrors go to the DLQ immediately — retrying will never fix them.
 * All other errors are re-thrown so Azure Functions retries the message up to
 * host.json `extensions.queues.maxDequeueCount` times before moving it to the
 * Azure poison queue.
 */
async function handleQueueEvent(
  moduleName: string,
  handlerName: string,
  dlq: StorageQueueOutput,
  context: ApplicationContext,
  queueItem: unknown,
  process: () => Promise<void>,
): Promise<void> {
  const trace = context.observability.startTrace(context.invocationId);
  try {
    await process();
    completeDataflowTrace(context.observability, trace, moduleName, handlerName, context.logger, {
      success: true,
      documentsWritten: 1,
      documentsFailed: 0,
      additionalMetrics: [{ name: 'acms_cmmap_handler_write_success', value: 1 }],
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      completeDataflowTrace(context.observability, trace, moduleName, handlerName, context.logger, {
        success: false,
        documentsWritten: 0,
        documentsFailed: 1,
        error: (error as Error).message,
        additionalMetrics: [{ name: 'acms_cmmap_handler_write_failure', value: 1 }],
      });
      context.extraOutputs.set(dlq, {
        type: 'QUEUE_ERROR',
        module: moduleName,
        activityName: handlerName,
        error: serializeError(error),
        originalEvent: queueItem,
      });
    } else {
      completeDataflowTrace(context.observability, trace, moduleName, handlerName, context.logger, {
        success: false,
        documentsWritten: 0,
        documentsFailed: 1,
        error: (error as Error).message,
        additionalMetrics: [{ name: 'acms_cmmap_handler_write_failure', value: 1 }],
      });
      throw error;
    }
  }
}

// ─── Staff assignment handler ─────────────────────────────────────────────────

/** Extracts the last word (uppercased) from a full name for ALPHA_SEARCH. */
export function extractLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1].toUpperCase();
}

/** Transforms a staff assignment event into a CMMAP_CAMS row for upsert. */
export function transformStaffAssignmentToRow(event: CaseAssignmentDownstreamEvent): CmmapCamsRow {
  const isUnassigned = !!event.unassignedOn;
  const apptDate = toAcmsDateNumeric(event.assignedOn);
  const dispDate = isUnassigned ? toAcmsDateNumeric(event.unassignedOn!) : null;

  return {
    ...buildBaseCmmapRow(event.caseId, event.acmsProfessionalId!, event.userId, event.name),
    RECORD_SEQ_NBR: 1,
    APPT_TYPE: 'S1',
    APPT_DATE: apptDate,
    APPT_DATE_DT: new Date(event.assignedOn),
    APPT_DISP: isUnassigned ? 'WD' : 'AP',
    DISP_DATE: dispDate,
    DISP_DATE_DT: isUnassigned ? new Date(event.unassignedOn!) : null,
    APPTEE_ACTIVE: isUnassigned ? 'N' : 'Y',
    ALPHA_SEARCH: extractLastName(event.name),
    LAST_UPDATED: event.unassignedOn ? new Date(event.unassignedOn) : new Date(event.assignedOn),
  };
}

export async function staffAssignmentHandler(
  queueItem: unknown,
  invocationContext: InvocationContext,
  dlq: StorageQueueOutput,
): Promise<void> {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  await handleQueueEvent(
    ModuleNames.STAFF_ASSIGNMENT_DOWNSTREAM,
    'staffAssignmentHandler',
    dlq,
    context,
    queueItem,
    async () => {
      const event = typeof queueItem === 'string' ? JSON.parse(queueItem) : queueItem;
      const assignmentEvent = event as CaseAssignmentDownstreamEvent;

      if (
        !assignmentEvent.caseId ||
        !assignmentEvent.userId ||
        !assignmentEvent.name ||
        !assignmentEvent.assignedOn ||
        !assignmentEvent.acmsProfessionalId
      ) {
        throw new ValidationError('Invalid assignment event: missing required fields');
      }

      const row = transformStaffAssignmentToRow(assignmentEvent);
      await upsertCmmapCamsRow(context, row);
    },
  );
}

// ─── Trustee appointment handler ──────────────────────────────────────────────

/** Transforms a trustee appointment event into a CMMAP_CAMS row for upsert. */
export function transformTrusteeAppointmentToRow(
  event: TrusteeAppointmentDownstreamEvent,
): CmmapCamsRow {
  const isUnassigned = !!event.unassignedOn;
  const apptDateSource = event.appointedDate ?? event.assignedOn;
  const apptDate = toAcmsDateNumeric(apptDateSource);
  const dispDate = isUnassigned ? toAcmsDateNumeric(event.unassignedOn!) : null;

  return {
    ...buildBaseCmmapRow(event.caseId, event.acmsProfessionalId, 'CAMS', 'CAMS'),
    RECORD_SEQ_NBR: 1,
    APPT_TYPE: 'TR',
    APPT_DATE: apptDate,
    APPT_DATE_DT: new Date(apptDateSource),
    APPT_DISP: isUnassigned ? 'WD' : 'GR',
    DISP_DATE: dispDate,
    DISP_DATE_DT: isUnassigned ? new Date(event.unassignedOn!) : null,
    APPTEE_ACTIVE: isUnassigned ? 'N' : 'Y',
    ALPHA_SEARCH: null,
    LAST_UPDATED: event.unassignedOn
      ? new Date(event.unassignedOn)
      : event.appointedDate
        ? new Date(event.appointedDate)
        : new Date(event.assignedOn),
  };
}

export async function trusteeAppointmentHandler(
  queueItem: unknown,
  invocationContext: InvocationContext,
  dlq: StorageQueueOutput,
): Promise<void> {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  await handleQueueEvent(
    ModuleNames.TRUSTEE_APPOINTMENT_DOWNSTREAM,
    'trusteeAppointmentHandler',
    dlq,
    context,
    queueItem,
    async () => {
      const event = typeof queueItem === 'string' ? JSON.parse(queueItem) : queueItem;
      const appointmentEvent = event as TrusteeAppointmentDownstreamEvent;

      if (
        !appointmentEvent.caseId ||
        !appointmentEvent.trusteeId ||
        !appointmentEvent.assignedOn ||
        !appointmentEvent.chapter ||
        !appointmentEvent.acmsProfessionalId
      ) {
        throw new ValidationError('Invalid trustee appointment event: missing required fields');
      }

      const row = transformTrusteeAppointmentToRow(appointmentEvent);
      await upsertCmmapCamsRow(context, row);
    },
  );
}

// ─── ACMS daily sync handler ──────────────────────────────────────────────────

const DAILY_SYNC_MODULE = ModuleNames.ACMS_CAMS_TRANSITION_DAILY_SYNC;
const DAILY_SYNC_TIMER = buildFunctionName(DAILY_SYNC_MODULE, 'timerTrigger');

// UNIX epoch used as watermark on first run — triggers full CMMAP load.
const EPOCH_WATERMARK = new Date(0);

async function readWatermark(client: AcmsRepSubClient, context: ApplicationContext): Promise<Date> {
  const result = await client.executeQuery<{ LAST_SYNC_DATE: Date }>(
    context,
    `SELECT LAST_SYNC_DATE FROM CMMAP_SYNC_CONTROL WHERE PROCESS_NAME = 'ACMS_DAILY'`,
  );
  const recordset = (result.results as { recordset: { LAST_SYNC_DATE: Date }[] })?.recordset;
  return recordset?.[0]?.LAST_SYNC_DATE ?? EPOCH_WATERMARK;
}

async function updateWatermark(
  client: AcmsRepSubClient,
  context: ApplicationContext,
  runAt: Date,
): Promise<void> {
  const result = await client.executeQuery(
    context,
    `
    MERGE INTO CMMAP_SYNC_CONTROL AS target
    USING (VALUES ('ACMS_DAILY')) AS source (PROCESS_NAME)
    ON target.PROCESS_NAME = source.PROCESS_NAME
    WHEN MATCHED THEN
      UPDATE SET
        LAST_SYNC_DATE = @LAST_SYNC_DATE,
        LAST_RUN_AT    = @LAST_RUN_AT
    WHEN NOT MATCHED THEN
      INSERT (PROCESS_NAME, LAST_SYNC_DATE, LAST_RUN_AT)
      VALUES ('ACMS_DAILY', @LAST_SYNC_DATE, @LAST_RUN_AT);
  `,
    [
      {
        name: 'LAST_SYNC_DATE',
        type: sql.DateTime2(3) as unknown as sql.ISqlTypeFactoryWithNoParams,
        value: runAt,
      },
      {
        name: 'LAST_RUN_AT',
        type: sql.DateTime2(3) as unknown as sql.ISqlTypeFactoryWithNoParams,
        value: runAt,
      },
    ],
  );
  const rowsAffected = (result.results as { rowsAffected: number[] })?.rowsAffected;
  if ((rowsAffected?.[0] ?? 0) === 0) {
    throw new Error('updateWatermark MERGE affected 0 rows — unexpected state.');
  }
}

/**
 * Merges ACMS appointments into CMMAP_ALL.
 * CAMS-owned rows (SOURCE='CAMS') are never overwritten.
 *
 * fullLoad=true  — first-run: seeds all CMMAP rows including predecessors.
 * fullLoad=false — incremental: active rows newer than the watermark only.
 *                  Predecessors are seeded once at full-load and never mutated
 *                  by ACMS after CAMS takes over a division.
 */
async function mergeCmmapRows(
  client: AcmsRepSubClient,
  context: ApplicationContext,
  watermark: Date,
  fullLoad: boolean,
): Promise<number> {
  const sourceQuery = fullLoad
    ? `
      -- Full load: all CMMAP rows, all statuses
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
      WHERE m.DELETE_CODE = ' '`
    : `
      -- Incremental: active appointments newer than watermark only.
      -- Predecessors were seeded at full-load and are not re-synced
      -- because ACMS does not mutate predecessor rows after CAMS takes
      -- over appointments for a division.
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
              CONVERT(VARCHAR(8), @WATERMARK, 112))`;

  const result = await client.executeQuery(
    context,
    `
    MERGE INTO CMMAP_ALL AS target
    USING (
      ${sourceQuery}
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
  `,
    [
      {
        name: 'WATERMARK',
        type: sql.DateTime2(3) as unknown as sql.ISqlTypeFactoryWithNoParams,
        value: watermark,
      },
      {
        name: 'RUN_AT',
        type: sql.DateTime2(3) as unknown as sql.ISqlTypeFactoryWithNoParams,
        value: new Date(),
      },
    ],
  );

  const rowsAffected = (result.results as { rowsAffected: number[] })?.rowsAffected;
  return rowsAffected?.[0] ?? 0;
}

async function syncAcmsToAll(invocationContext: InvocationContext): Promise<void> {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const client = new AcmsRepSubClient(context);
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    const watermark = await readWatermark(client, context);
    const fullLoad = watermark.getTime() === EPOCH_WATERMARK.getTime();
    const rowsAffected = await mergeCmmapRows(client, context, watermark, fullLoad);
    const runAt = new Date();
    await updateWatermark(client, context, runAt);

    completeDataflowTrace(
      context.observability,
      trace,
      DAILY_SYNC_MODULE,
      'syncAcmsToAll',
      context.logger,
      {
        success: true,
        documentsWritten: rowsAffected,
        documentsFailed: 0,
        details: {
          watermark: watermark.toISOString(),
          newWatermark: runAt.toISOString(),
          fullLoad: String(fullLoad),
        },
        additionalMetrics: [{ name: 'acms_cmmap_sync_rows_merged', value: rowsAffected }],
      },
    );
  } catch (error) {
    completeDataflowTrace(
      context.observability,
      trace,
      DAILY_SYNC_MODULE,
      'syncAcmsToAll',
      context.logger,
      {
        success: false,
        documentsWritten: 0,
        documentsFailed: 1,
        error: error instanceof Error ? error.message : String(error),
        additionalMetrics: [{ name: 'acms_cmmap_sync_rows_merged', value: 0 }],
      },
    );
    throw error;
  }
}

export const AcmsDailySync = {
  MODULE_NAME: DAILY_SYNC_MODULE,
  setup() {
    app.timer(DAILY_SYNC_TIMER, {
      // Daily at 02:00 UTC — after ACMS replica refresh, before business hours
      schedule: '0 0 2 * * *',
      handler: (_timer, context) => syncAcmsToAll(context),
    });
  },
  syncAcmsToAll,
};
