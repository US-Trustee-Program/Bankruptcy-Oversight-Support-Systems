import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import { isNotFoundError } from '../../common-errors/not-found-error';
import { isTooManyRequestsError } from '../../common-errors/too-many-requests-error';
import factory from '../../factory';
import { MaybeData } from './queue-types';
import {
  MigrateCaseAppointmentsState,
  AcmsCaseAppointmentRecord,
  AcmsCaseAppointmentRawRecord,
  formatCaseId,
  formatAcmsProfessionalId,
} from '../gateways.types';
import { CaseAppointmentInput } from '@common/cams/trustee-appointments';

export type ResolvedAcmsRecord = AcmsCaseAppointmentRecord & {
  trusteeId: string | null; // null = no mapping found, skip write
};

type FailedRecord = {
  record: AcmsCaseAppointmentRecord;
  reason: string;
};

type WriteRecordResult =
  | { kind: 'success' }
  | { kind: 'failure'; failure: FailedRecord }
  | { kind: 'rateLimited' };

const MODULE_NAME = 'MIGRATE-CASE-APPOINTMENTS-USE-CASE';

export const CMMAP_CUTOFF_DATE: string | null = null;

const BASE_DELAY_MS = 30_000;
const MAX_BACKOFF_MS = 10 * 60 * 1000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Module-level professional ID map cache. Populated on first readPage call per
// warm instance; null forces a Cosmos reload (cold start or after fresh start reset).
let professionalIdMapCache: Map<string, string> | null = null;

export function clearProfessionalIdMapCache(): void {
  professionalIdMapCache = null;
}

function formatAcmsDate(acmsDate: number): string {
  const s = acmsDate.toString();
  if (s.length !== 8 || acmsDate < 10000000) {
    throw new Error(`Invalid ACMS date format: ${acmsDate}. Expected 8-digit YYYYMMDD.`);
  }
  const year = s.slice(0, 4);
  const month = s.slice(4, 6);
  const day = s.slice(6, 8);
  const formatted = `${year}-${month}-${day}`;

  const date = new Date(formatted);
  if (isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== formatted) {
    throw new Error(`Invalid date: ${formatted} from ACMS date ${acmsDate}`);
  }

  return formatted;
}

function rawToAppointmentRecord(raw: AcmsCaseAppointmentRawRecord): AcmsCaseAppointmentRecord {
  return {
    id: raw.id,
    caseId: formatCaseId(raw.CASE_DIV, raw.CASE_YEAR, raw.CASE_NUMBER),
    acmsProfessionalId: formatAcmsProfessionalId(raw.GROUP_DESIGNATOR, raw.PROF_CODE),
    assignDate: raw.APPT_DATE,
    apptDate: raw.APPT_DATE === 0 ? null : raw.APPT_DATE,
    unassignDate: raw.DISP_DATE,
  };
}

async function readMigrationState(
  context: ApplicationContext,
): Promise<MaybeData<MigrateCaseAppointmentsState | null>> {
  try {
    const repo = factory.getRuntimeStateRepository<MigrateCaseAppointmentsState>(context);
    const state = await repo.read('MIGRATE_CASE_APPOINTMENTS_STATE');
    return { data: state };
  } catch (originalError) {
    if (isNotFoundError(originalError)) {
      return { data: null };
    }
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to read migration state.'),
    };
  }
}

async function updateMigrationState(
  context: ApplicationContext,
  updates: {
    lastId: number | null;
    status: MigrateCaseAppointmentsState['status'];
    startedAt?: string;
    readingCompleted?: boolean;
    // Set to true on fresh start to zero all counters. Counter fields are otherwise
    // owned exclusively by atomicIncrement — never written here to avoid clobbering
    // concurrent increments from handlePage.
    resetCounters?: boolean;
  },
  // Pass pre-fetched state to avoid a redundant Cosmos read.
  // When provided, the internal read is skipped.
  prefetchedState?: MigrateCaseAppointmentsState | null,
): Promise<MaybeData<MigrateCaseAppointmentsState>> {
  try {
    const repo = factory.getRuntimeStateRepository<MigrateCaseAppointmentsState>(context);
    const now = new Date().toISOString();

    let stateBase: MigrateCaseAppointmentsState | null = prefetchedState ?? null;
    if (prefetchedState === undefined) {
      try {
        stateBase = await repo.read('MIGRATE_CASE_APPOINTMENTS_STATE');
      } catch (originalError) {
        if (!isNotFoundError(originalError)) {
          throw originalError;
        }
      }
    }

    const state: MigrateCaseAppointmentsState = {
      id: stateBase?.id,
      documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE',
      lastId: updates.lastId,
      // Counter fields: zeroed on reset, otherwise preserved from stateBase.
      // Never derived from updates — atomicIncrement owns them exclusively.
      processedCount: updates.resetCounters ? 0 : (stateBase?.processedCount ?? 0),
      failedCount: updates.resetCounters ? 0 : (stateBase?.failedCount ?? 0),
      reEnqueuedCount: updates.resetCounters ? 0 : (stateBase?.reEnqueuedCount ?? 0),
      acmsQueryRetries: updates.resetCounters ? 0 : (stateBase?.acmsQueryRetries ?? 0),
      resumeAttempts: updates.resetCounters ? 0 : (stateBase?.resumeAttempts ?? 0),
      readingCompleted: updates.readingCompleted ?? stateBase?.readingCompleted ?? false,
      startedAt: updates.startedAt ?? stateBase?.startedAt ?? now,
      lastUpdatedAt: now,
      status: updates.status,
    };

    const result = await repo.upsert(state);
    return { data: result };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to update migration state.'),
    };
  }
}

/**
 * readPage — fetch raw rows from ACMS, format, and pre-resolve professional IDs.
 * Returns pre-resolved records ready to be chunked into write queue messages.
 * Does NOT write to Cosmos. Does NOT update migration state.
 */
async function readPage(
  context: ApplicationContext,
  lastId: number | null,
  fetchSize: number,
): Promise<{
  records: ResolvedAcmsRecord[];
  nextLastId: number | null;
  isEmpty: boolean;
}> {
  const rawRecords = await factory
    .getAcmsGateway(context)
    .getCmmapAppointmentsRaw(context, lastId ?? 0, fetchSize, CMMAP_CUTOFF_DATE);

  if (rawRecords.length === 0) {
    return { records: [], nextLastId: null, isEmpty: true };
  }

  // Module-level cache wins on warm instances (zero Cosmos reads).
  // Cold starts fall back to a live findAll() fetch.
  if (!professionalIdMapCache) {
    const allMappings = await factory.getTrusteeProfessionalIdsRepository(context).findAll();
    professionalIdMapCache = new Map(
      allMappings.map((m) => [m.acmsProfessionalId, m.camsTrusteeId]),
    );
  }
  const professionalIdMap = professionalIdMapCache;

  const records: ResolvedAcmsRecord[] = rawRecords.map((raw) => ({
    ...rawToAppointmentRecord(raw),
    trusteeId:
      professionalIdMap.get(formatAcmsProfessionalId(raw.GROUP_DESIGNATOR, raw.PROF_CODE)) ?? null,
  }));

  const nextLastId = rawRecords[rawRecords.length - 1].id;
  return { records, nextLastId, isEmpty: false };
}

/**
 * writePage — write a batch of pre-resolved records to Cosmos serially.
 * Does NOT read from ACMS. Does NOT update migration state.
 *
 * On 429 (TooManyRequestsError), retries with exponential backoff (2^attempt * baseDelayMs).
 * If the next backoff sleep would push wall-clock elapsed past safeThresholdMs, the escape
 * hatch fires: remaining unprocessed records (including the current one) are returned so the
 * caller can re-enqueue them as a new PAGE message with a deferred visibility timeout.
 *
 * @param startedAt - wall-clock ms at invocation start; defaults to Date.now(). Injectable for testing.
 * @param safeThresholdMs - wall-clock milliseconds allowed before escape hatch fires; defaults to 58 minutes.
 * @param baseDelayMs - base delay in milliseconds for exponential backoff; defaults to BASE_DELAY_MS.
 */
async function writePage(
  context: ApplicationContext,
  records: ResolvedAcmsRecord[],
  options: {
    startedAt?: number;
    safeThresholdMs?: number;
    baseDelayMs?: number;
  } = {},
): Promise<{
  successCount: number;
  failures: FailedRecord[];
  remaining: ResolvedAcmsRecord[];
  recommendedVisibilitySeconds: number;
}> {
  const {
    startedAt = Date.now(),
    safeThresholdMs = 58 * 60 * 1000,
    baseDelayMs = BASE_DELAY_MS,
  } = options;
  const appointmentsRepo = factory.getTrusteeCaseAppointmentsRepository(context);
  const failures: FailedRecord[] = [];
  let successCount = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    let attempt = 0;

    while (true) {
      const result = await writeRecord(record, appointmentsRepo);

      if (result.kind === 'success') {
        successCount++;
        break;
      }

      if (result.kind === 'rateLimited') {
        const nextBackoffMs = Math.min(Math.pow(2, attempt + 1) * baseDelayMs, MAX_BACKOFF_MS);
        if (Date.now() - startedAt + nextBackoffMs >= safeThresholdMs) {
          return {
            successCount,
            failures,
            remaining: records.slice(i),
            recommendedVisibilitySeconds: Math.ceil(nextBackoffMs / 1000),
          };
        }
        await sleep(nextBackoffMs);
        attempt++;
      } else {
        failures.push(result.failure);
        break;
      }
    }
  }

  return { successCount, failures, remaining: [], recommendedVisibilitySeconds: 0 };
}

async function writeRecord(
  record: ResolvedAcmsRecord,
  appointmentsRepo: ReturnType<typeof factory.getTrusteeCaseAppointmentsRepository>,
): Promise<WriteRecordResult> {
  if (!record.trusteeId) {
    return { kind: 'failure', failure: { record, reason: 'trustee-not-found' } };
  }

  let assignedOn: string;
  let appointedDate: string | undefined;
  let unassignedOn: string | undefined;
  try {
    assignedOn = formatAcmsDate(record.assignDate);
    if (record.apptDate) appointedDate = formatAcmsDate(record.apptDate);
    if (record.unassignDate) unassignedOn = formatAcmsDate(record.unassignDate);
  } catch (error) {
    return { kind: 'failure', failure: { record, reason: String(error) } };
  }

  const input: CaseAppointmentInput = {
    caseId: record.caseId,
    trusteeId: record.trusteeId,
    assignedOn,
    ...(appointedDate ? { appointedDate } : {}),
    ...(unassignedOn ? { unassignedOn } : {}),
    source: 'acms',
  };

  try {
    await appointmentsRepo.upsert(input);
    return { kind: 'success' };
  } catch (originalError) {
    if (isTooManyRequestsError(originalError)) {
      return { kind: 'rateLimited' };
    }
    return { kind: 'failure', failure: { record, reason: String(originalError) } };
  }
}

async function incrementMetric(
  context: ApplicationContext,
  field: keyof MigrateCaseAppointmentsState & string,
  amount: number = 1,
): Promise<void> {
  try {
    const repo = factory.getRuntimeStateRepository<MigrateCaseAppointmentsState>(context);
    await repo.atomicIncrement('MIGRATE_CASE_APPOINTMENTS_STATE', field, amount);
  } catch (e) {
    // Metric failure is non-fatal — do not halt the migration
    const msg = e instanceof Error ? e.message : String(e);
    context.logger.warn(MODULE_NAME, `Failed to increment metric '${field}': ${msg} — continuing.`);
  }
}

async function deleteAll(
  context: ApplicationContext,
): Promise<MaybeData<{ deletedCount: number }>> {
  try {
    const repo = factory.getTrusteeCaseAppointmentsRepository(context);
    const result = await repo.deleteAllBySource('acms');
    return { data: result };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to delete all ACMS appointments.'),
    };
  }
}

const MigrateCaseAppointmentsUseCase = {
  readMigrationState,
  updateMigrationState,
  readPage,
  writePage,
  deleteAll,
  incrementMetric,
  clearProfessionalIdMapCache,
};

export default MigrateCaseAppointmentsUseCase;
