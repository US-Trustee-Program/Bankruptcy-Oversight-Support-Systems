import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import { isNotFoundError } from '../../common-errors/not-found-error';
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

const MODULE_NAME = 'MIGRATE-CASE-APPOINTMENTS-USE-CASE';

export const CMMAP_CUTOFF_DATE: string | null = null;

const WRITE_CONCURRENCY = 50;

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
    processedCount: number;
    status: MigrateCaseAppointmentsState['status'];
    startedAt?: string;
    pagesRead?: number;
    failedCount?: number;
    acmsQueryRetries?: number;
    resumeAttempts?: number;
    deletedOnReset?: number;
    readingCompleted?: boolean;
  },
  existingState?: MigrateCaseAppointmentsState | null,
): Promise<MaybeData<MigrateCaseAppointmentsState>> {
  try {
    const repo = factory.getRuntimeStateRepository<MigrateCaseAppointmentsState>(context);
    const now = new Date().toISOString();

    let stateBase = existingState;
    if (stateBase === undefined) {
      try {
        stateBase = await repo.read('MIGRATE_CASE_APPOINTMENTS_STATE');
      } catch (originalError) {
        if (!isNotFoundError(originalError)) {
          throw originalError;
        }
        stateBase = null;
      }
    }

    const state: MigrateCaseAppointmentsState = {
      id: stateBase?.id,
      documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE',
      lastId: updates.lastId,
      // Counter fields always written as numbers — never omitted or null.
      // atomicIncrement uses $inc which fails on null fields in Cosmos.
      processedCount: updates.processedCount ?? stateBase?.processedCount ?? 0,
      pagesRead: updates.pagesRead ?? stateBase?.pagesRead ?? 0,
      failedCount: updates.failedCount ?? stateBase?.failedCount ?? 0,
      acmsQueryRetries: updates.acmsQueryRetries ?? stateBase?.acmsQueryRetries ?? 0,
      resumeAttempts: updates.resumeAttempts ?? stateBase?.resumeAttempts ?? 0,
      deletedOnReset: updates.deletedOnReset ?? stateBase?.deletedOnReset ?? 0,
      readingCompleted: updates.readingCompleted ?? stateBase?.readingCompleted,

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
 * writePage — write a batch of pre-resolved records to Cosmos.
 * Does NOT read from ACMS. Does NOT update migration state.
 */
async function writePage(
  context: ApplicationContext,
  records: ResolvedAcmsRecord[],
): Promise<{ successCount: number; failures: FailedRecord[] }> {
  const appointmentsRepo = factory.getTrusteeCaseAppointmentsRepository(context);
  const failures: FailedRecord[] = [];
  let successCount = 0;
  let index = 0;

  while (index < records.length) {
    const batch = records.slice(index, index + WRITE_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((record) => writeRecord(record, appointmentsRepo)),
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        failures.push({ record: batch[results.indexOf(result)], reason: String(result.reason) });
      } else if (result.value.success) {
        successCount++;
      } else {
        failures.push((result.value as { success: false; failure: FailedRecord }).failure);
      }
    }
    index += WRITE_CONCURRENCY;
  }

  return { successCount, failures };
}

async function writeRecord(
  record: ResolvedAcmsRecord,
  appointmentsRepo: ReturnType<typeof factory.getTrusteeCaseAppointmentsRepository>,
): Promise<{ success: true } | { success: false; failure: FailedRecord }> {
  if (!record.trusteeId) {
    return { success: false, failure: { record, reason: 'trustee-not-found' } };
  }

  let assignedOn: string;
  let appointedDate: string | undefined;
  let unassignedOn: string | undefined;
  try {
    assignedOn = formatAcmsDate(record.assignDate);
    if (record.apptDate) appointedDate = formatAcmsDate(record.apptDate);
    if (record.unassignDate) unassignedOn = formatAcmsDate(record.unassignDate);
  } catch (error) {
    return { success: false, failure: { record, reason: String(error) } };
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
    return { success: true };
  } catch (originalError) {
    return { success: false, failure: { record, reason: String(originalError) } };
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
