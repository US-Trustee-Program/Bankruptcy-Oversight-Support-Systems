import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import { isNotFoundError } from '../../common-errors/not-found-error';
import { CamsError } from '../../common-errors/cams-error';
import factory from '../../factory';
import { MaybeData } from './queue-types';
import { MigrateCaseAppointmentsState, AcmsCaseAppointmentRecord } from '../gateways.types';
import { CaseAppointmentInput } from '@common/cams/trustee-appointments';

type FailedRecord = {
  record: AcmsCaseAppointmentRecord;
  reason: string;
};

const MODULE_NAME = 'MIGRATE-CASE-APPOINTMENTS-USE-CASE';

export const CMMAP_CUTOFF_DATE: string | null = null;

type PageResult =
  | { status: 'empty' }
  | { status: 'error'; error: CamsError }
  | {
      status: 'done';
      processedCount: number;
      successCount: number;
      failures: FailedRecord[];
      nextLastId: null;
    }
  | {
      status: 'continue';
      processedCount: number;
      successCount: number;
      failures: FailedRecord[];
      nextLastId: number;
    };

function formatAcmsDate(acmsDate: number): string {
  const s = acmsDate.toString();
  if (s.length !== 8 || acmsDate < 10000000) {
    throw new Error(`Invalid ACMS date format: ${acmsDate}. Expected 8-digit YYYYMMDD.`);
  }
  const year = s.slice(0, 4);
  const month = s.slice(4, 6);
  const day = s.slice(6, 8);
  const formatted = `${year}-${month}-${day}`;

  // Validate date is real
  const date = new Date(formatted);
  if (isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== formatted) {
    throw new Error(`Invalid date: ${formatted} from ACMS date ${acmsDate}`);
  }

  return formatted;
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
      processedCount: updates.processedCount,
      startedAt: stateBase?.startedAt ?? now,
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

const WRITE_CONCURRENCY = 50;

async function processRecord(
  record: AcmsCaseAppointmentRecord,
  professionalIdMap: Map<string, string>,
  appointmentsRepo: ReturnType<typeof factory.getTrusteeCaseAppointmentsRepository>,
): Promise<{ success: true } | { success: false; failure: FailedRecord }> {
  const trusteeId = professionalIdMap.get(record.acmsProfessionalId);
  if (!trusteeId) {
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
    trusteeId,
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

async function processPage(
  context: ApplicationContext,
  lastId: number | null,
  pageSize: number,
): Promise<PageResult> {
  try {
    const stateResult = await readMigrationState(context);
    if (stateResult.error) return { status: 'error', error: stateResult.error as CamsError };
    const existingState = stateResult.data;
    const currentProcessedCount = existingState?.processedCount ?? 0;

    let records: AcmsCaseAppointmentRecord[];
    try {
      records = await factory
        .getAcmsGateway(context)
        .getCmmapAppointments(context, lastId ?? 0, pageSize, CMMAP_CUTOFF_DATE);
    } catch (originalError) {
      return {
        status: 'error',
        error: getCamsError(originalError, MODULE_NAME, 'Failed to fetch CMMAP appointments.'),
      };
    }

    if (records.length === 0) {
      await updateMigrationState(
        context,
        { lastId, processedCount: currentProcessedCount, status: 'COMPLETED' },
        existingState,
      );
      return { status: 'empty' };
    }

    // Pre-load all professional ID mappings once per page into a Map for O(1) lookup.
    // Avoids one cross-partition Cosmos scatter per record.
    const professionalIdsRepo = factory.getTrusteeProfessionalIdsRepository(context);
    const allMappings = await professionalIdsRepo.findAll();
    const professionalIdMap = new Map(
      allMappings.map((m) => [m.acmsProfessionalId, m.camsTrusteeId]),
    );

    const appointmentsRepo = factory.getTrusteeCaseAppointmentsRepository(context);

    // Process records in parallel with a concurrency cap to avoid overwhelming Cosmos.
    const failures: FailedRecord[] = [];
    let successCount = 0;
    let index = 0;

    while (index < records.length) {
      const batch = records.slice(index, index + WRITE_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((record) => processRecord(record, professionalIdMap, appointmentsRepo)),
      );
      for (const result of results) {
        if (result.status === 'rejected') {
          // Unexpected — processRecord catches all errors internally, but guard anyway
          failures.push({ record: batch[results.indexOf(result)], reason: String(result.reason) });
        } else if (result.value.success) {
          successCount++;
        } else {
          failures.push((result.value as { success: false; failure: FailedRecord }).failure);
        }
      }
      index += WRITE_CONCURRENCY;
    }

    const maxId = records[records.length - 1].id;
    const newProcessedCount = currentProcessedCount + records.length;
    const isLastPage = records.length < pageSize;
    const status: MigrateCaseAppointmentsState['status'] = isLastPage ? 'COMPLETED' : 'IN_PROGRESS';

    await updateMigrationState(
      context,
      { lastId: maxId, processedCount: newProcessedCount, status },
      existingState,
    );

    if (isLastPage) {
      return {
        status: 'done',
        processedCount: newProcessedCount,
        successCount,
        failures,
        nextLastId: null,
      };
    }

    return {
      status: 'continue',
      processedCount: newProcessedCount,
      successCount,
      failures,
      nextLastId: maxId,
    };
  } catch (originalError) {
    return {
      status: 'error',
      error: getCamsError(originalError, MODULE_NAME, 'Failed to process page.'),
    };
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
  processPage,
  deleteAll,
};

export default MigrateCaseAppointmentsUseCase;
