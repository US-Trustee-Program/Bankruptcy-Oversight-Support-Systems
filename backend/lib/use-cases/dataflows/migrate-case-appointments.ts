import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import { isNotFoundError } from '../../common-errors/not-found-error';
import { CamsError } from '../../common-errors/cams-error';
import factory from '../../factory';
import { MaybeData } from './queue-types';
import { MigrateCaseAppointmentsState, AcmsCaseAppointmentRecord } from '../gateways.types';
import { CaseAppointment, CaseAppointmentInput } from '@common/cams/trustee-appointments';

const MODULE_NAME = 'MIGRATE-CASE-APPOINTMENTS-USE-CASE';

export const CMMAP_CUTOFF_DATE: string | null = null;

type FailedRecord = {
  record: AcmsCaseAppointmentRecord;
  reason: string;
};

type PageResult =
  | { status: 'empty' }
  | { status: 'error'; error: CamsError }
  | {
      status: 'done';
      processedCount: number;
      successCount: number;
      failedCount: number;
      nextLastId: null;
    }
  | {
      status: 'continue';
      processedCount: number;
      successCount: number;
      failedCount: number;
      nextLastId: number;
    };

function formatAcmsDate(acmsDate: number): string {
  const s = acmsDate.toString();
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
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

function checkDiscrepancy(
  context: ApplicationContext,
  caseId: string,
  incomingAcmsTrusteeId: string,
  existingAppointments: CaseAppointment[],
): void {
  const activeDxtr = existingAppointments.find((a) => a.source === 'dxtr' && !a.unassignedOn);
  if (!activeDxtr) return;
  if (activeDxtr.trusteeId !== incomingAcmsTrusteeId) {
    context.logger.warn(MODULE_NAME, 'DXTR_ACMS_TRUSTEE_DISCREPANCY', {
      caseId,
      dxtrTrusteeId: activeDxtr.trusteeId,
      acmsTrusteeId: incomingAcmsTrusteeId,
    });
  }
}

async function processPage(
  context: ApplicationContext,
  lastId: number | null,
  pageSize: number,
): Promise<PageResult> {
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

  const failures: FailedRecord[] = [];
  let successCount = 0;

  const professionalIdsRepo = factory.getTrusteeProfessionalIdsRepository(context);
  const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);

  for (const record of records) {
    let trusteeId: string;
    try {
      const matches = await professionalIdsRepo.findByAcmsProfessionalId(record.acmsProfessionalId);
      if (matches.length === 0) {
        failures.push({ record, reason: 'trustee-not-found' });
        continue;
      }
      trusteeId = matches[0].camsTrusteeId;
    } catch {
      failures.push({ record, reason: 'trustee-lookup-error' });
      continue;
    }

    let existingAppointments: CaseAppointment[] = [];
    try {
      existingAppointments = await appointmentsRepo.findByCaseId(record.caseId);
      const assignedOn = formatAcmsDate(record.assignDate);
      const duplicate = existingAppointments.some(
        (a) => a.trusteeId === trusteeId && a.source === 'acms' && a.assignedOn === assignedOn,
      );
      if (duplicate) continue;
    } catch {
      failures.push({ record, reason: 'duplicate-check-failed' });
      continue;
    }

    const input: CaseAppointmentInput = {
      caseId: record.caseId,
      trusteeId,
      assignedOn: formatAcmsDate(record.assignDate),
      ...(record.apptDate ? { appointedDate: formatAcmsDate(record.apptDate) } : {}),
      ...(record.unassignDate ? { unassignedOn: formatAcmsDate(record.unassignDate) } : {}),
      source: 'acms',
    };

    try {
      await appointmentsRepo.createCaseAppointment(input);
      successCount++;
      if (!record.unassignDate) {
        checkDiscrepancy(context, record.caseId, trusteeId, existingAppointments);
      }
    } catch (originalError) {
      failures.push({ record, reason: String(originalError) });
    }
  }

  if (failures.length > 0) {
    const objectStorage = factory.getObjectStorageGateway(context);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `failed-case-appointments-${timestamp}.jsonl`;
    const content = failures.map((f) => JSON.stringify(f)).join('\n');
    try {
      await objectStorage.writeObject('migrate-case-appointments-failures', fileName, content);
    } catch (writeError) {
      context.logger.warn(
        MODULE_NAME,
        `Failed to write failures file — continuing. ${failures.length} failures lost.`,
        writeError,
      );
    }
  }

  const maxId = records[records.length - 1].id;
  const newProcessedCount = currentProcessedCount + records.length;

  await updateMigrationState(
    context,
    { lastId: maxId, processedCount: newProcessedCount, status: 'IN_PROGRESS' },
    existingState,
  );

  if (records.length < pageSize) {
    await updateMigrationState(
      context,
      { lastId: maxId, processedCount: newProcessedCount, status: 'COMPLETED' },
      existingState,
    );
    return {
      status: 'done',
      processedCount: newProcessedCount,
      successCount,
      failedCount: failures.length,
      nextLastId: null,
    };
  }

  return {
    status: 'continue',
    processedCount: newProcessedCount,
    successCount,
    failedCount: failures.length,
    nextLastId: maxId,
  };
}

async function processSingleRecord(
  context: ApplicationContext,
  record: AcmsCaseAppointmentRecord,
): Promise<{ status: 'success' } | { status: 'skipped' } | { status: 'error'; error: CamsError }> {
  const professionalIdsRepo = factory.getTrusteeProfessionalIdsRepository(context);
  const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);

  let trusteeId: string;
  try {
    const matches = await professionalIdsRepo.findByAcmsProfessionalId(record.acmsProfessionalId);
    if (matches.length === 0) {
      return { status: 'skipped' };
    }
    trusteeId = matches[0].camsTrusteeId;
  } catch (originalError) {
    return {
      status: 'error',
      error: getCamsError(originalError, MODULE_NAME, 'Failed to look up trustee professional ID.'),
    };
  }

  try {
    const existingAppointments = await appointmentsRepo.findByCaseId(record.caseId);
    const assignedOn = formatAcmsDate(record.assignDate);
    const duplicate = existingAppointments.some(
      (a) => a.trusteeId === trusteeId && a.source === 'acms' && a.assignedOn === assignedOn,
    );
    if (duplicate) return { status: 'skipped' };
  } catch (originalError) {
    return {
      status: 'error',
      error: getCamsError(originalError, MODULE_NAME, 'Failed to check for duplicate appointment.'),
    };
  }

  const input: CaseAppointmentInput = {
    caseId: record.caseId,
    trusteeId,
    assignedOn: formatAcmsDate(record.assignDate),
    ...(record.apptDate ? { appointedDate: formatAcmsDate(record.apptDate) } : {}),
    ...(record.unassignDate ? { unassignedOn: formatAcmsDate(record.unassignDate) } : {}),
    source: 'acms',
  };

  try {
    await appointmentsRepo.createCaseAppointment(input);
    return { status: 'success' };
  } catch (originalError) {
    return {
      status: 'error',
      error: getCamsError(originalError, MODULE_NAME, 'Failed to create case appointment.'),
    };
  }
}

const MigrateCaseAppointmentsUseCase = {
  readMigrationState,
  updateMigrationState,
  processPage,
  processSingleRecord,
};

export default MigrateCaseAppointmentsUseCase;
