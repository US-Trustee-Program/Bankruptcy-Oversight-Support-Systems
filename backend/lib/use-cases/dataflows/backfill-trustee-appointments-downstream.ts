import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import { isNotFoundError } from '../../common-errors/not-found-error';
import factory from '../../factory';
import { TrusteeAppointmentsDownstreamBackfillState } from '../gateways.types';
import { MaybeData } from './queue-types';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import { TrusteeAppointmentDownstreamEvent } from '@common/cams/dataflow-events';
import { resolveGroupMatchedProfessionalId } from './sync-trustee-appointments';

const MODULE_NAME = 'BACKFILL-TRUSTEE-APPOINTMENTS-DOWNSTREAM-USE-CASE';

type AppointmentsPageResult = {
  appointments: Array<CaseAppointment & { _id: string }>;
  lastId: string | null;
  hasMore: boolean;
};

type ProcessPageResult = {
  successCount: number;
  errors: Array<{ caseId: string; message: string }>;
};

/**
 * Gets a page of CaseAppointment documents using cursor-based pagination.
 * Fetches limit+1 to detect whether more results exist.
 */
async function getPageOfAppointments(
  context: ApplicationContext,
  lastId: string | null,
  limit: number,
): Promise<MaybeData<AppointmentsPageResult>> {
  try {
    const repo = factory.getTrusteeAppointmentsRepository(context);
    const results = await repo.getAllCaseAppointments(lastId, limit + 1);

    const hasMore = results.length > limit;
    const appointments = results.slice(0, limit);
    const newLastId = appointments.length > 0 ? appointments[appointments.length - 1]._id : null;

    return {
      data: {
        appointments,
        lastId: newLastId,
        hasMore,
      },
    };
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to get page of appointments (lastId: ${lastId}, limit: ${limit}).`,
      ),
    };
  }
}

/**
 * Processes a page of CaseAppointment records, queuing a TrusteeAppointmentDownstreamEvent
 * for each one where an ACMS professional ID can be resolved.
 * Appointments with no resolvable professional ID are skipped (sync error doc written).
 * Failures to look up the synced case are recorded per-item; the page continues.
 */
async function processAppointmentsPage(
  context: ApplicationContext,
  appointments: Array<CaseAppointment & { _id: string }>,
): Promise<MaybeData<ProcessPageResult>> {
  const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);
  const casesRepo = factory.getCasesRepository(context);
  const apiToDataflows = factory.getApiToDataflowsGateway(context);
  let successCount = 0;
  const errors: Array<{ caseId: string; message: string }> = [];

  for (const appointment of appointments) {
    try {
      const syncedCase = await casesRepo.getSyncedCase(appointment.caseId);

      const acmsProfessionalId = await resolveGroupMatchedProfessionalId(
        context,
        appointmentsRepo,
        appointment.trusteeId,
        syncedCase.courtDivisionCode,
        {
          caseId: appointment.caseId,
          trusteeId: appointment.trusteeId,
          assignedOn: appointment.assignedOn,
          ...(appointment.appointedDate ? { appointedDate: appointment.appointedDate } : {}),
          ...(appointment.unassignedOn ? { unassignedOn: appointment.unassignedOn } : {}),
          chapter: syncedCase.chapter,
          courtDivisionCode: syncedCase.courtDivisionCode,
        },
      );

      if (acmsProfessionalId === null) {
        // Sync error doc already written by resolveGroupMatchedProfessionalId
        continue;
      }

      const event: TrusteeAppointmentDownstreamEvent = {
        caseId: appointment.caseId,
        trusteeId: appointment.trusteeId,
        acmsProfessionalId,
        assignedOn: appointment.assignedOn,
        ...(appointment.appointedDate ? { appointedDate: appointment.appointedDate } : {}),
        ...(appointment.unassignedOn ? { unassignedOn: appointment.unassignedOn } : {}),
        chapter: syncedCase.chapter,
      };

      await apiToDataflows.queueTrusteeAppointmentEvent(event);
      successCount++;
    } catch (originalError) {
      const message =
        originalError instanceof Error ? originalError.message : String(originalError);
      context.logger.warn(
        MODULE_NAME,
        `Failed to process appointment for case ${appointment.caseId}: ${message}`,
      );
      errors.push({ caseId: appointment.caseId, message });
      try {
        await appointmentsRepo.upsertDownstreamSyncError({
          documentType: 'TRUSTEE_APPOINTMENT_DOWNSTREAM_SYNC_ERROR',
          groupDesignator: null,
          caseId: appointment.caseId,
          trusteeId: appointment.trusteeId,
          assignedOn: appointment.assignedOn,
          ...(appointment.appointedDate ? { appointedDate: appointment.appointedDate } : {}),
          ...(appointment.unassignedOn ? { unassignedOn: appointment.unassignedOn } : {}),
          chapter: '',
          courtDivisionCode: '',
        });
      } catch (writeError) {
        context.logger.warn(
          MODULE_NAME,
          `Failed to write sync error doc for case ${appointment.caseId}`,
          writeError,
        );
      }
    }
  }

  return { data: { successCount, errors } };
}

/**
 * Reads the current backfill state from the runtime-state collection.
 * Returns null if no state exists (first run).
 */
async function readBackfillState(
  context: ApplicationContext,
): Promise<MaybeData<TrusteeAppointmentsDownstreamBackfillState | null>> {
  try {
    const repo = factory.getTrusteeAppointmentsDownstreamBackfillStateRepo(context);
    const state = await repo.read('TRUSTEE_APPOINTMENTS_DOWNSTREAM_BACKFILL_STATE');
    return { data: state };
  } catch (originalError) {
    if (isNotFoundError(originalError)) {
      return { data: null };
    }
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to read backfill state.'),
    };
  }
}

/**
 * Updates the backfill state in the runtime-state collection.
 * Uses upsert to create if not exists or update if exists, preserving startedAt.
 */
async function updateBackfillState(
  context: ApplicationContext,
  updates: {
    lastId: string | null;
    processedCount: number;
    status: TrusteeAppointmentsDownstreamBackfillState['status'];
  },
): Promise<MaybeData<TrusteeAppointmentsDownstreamBackfillState>> {
  try {
    const repo = factory.getTrusteeAppointmentsDownstreamBackfillStateRepo(context);
    const now = new Date().toISOString();

    let existingState: TrusteeAppointmentsDownstreamBackfillState | null = null;
    try {
      existingState = await repo.read('TRUSTEE_APPOINTMENTS_DOWNSTREAM_BACKFILL_STATE');
    } catch (originalError) {
      if (!isNotFoundError(originalError)) {
        throw originalError;
      }
    }

    const state: TrusteeAppointmentsDownstreamBackfillState = {
      id: existingState?.id,
      documentType: 'TRUSTEE_APPOINTMENTS_DOWNSTREAM_BACKFILL_STATE',
      lastId: updates.lastId,
      processedCount: updates.processedCount,
      startedAt: existingState?.startedAt ?? now,
      lastUpdatedAt: now,
      status: updates.status,
    };

    const result = await repo.upsert(state);
    return { data: result };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to update backfill state.'),
    };
  }
}

const BackfillTrusteeAppointmentsDownstream = {
  getPageOfAppointments,
  processAppointmentsPage,
  readBackfillState,
  updateBackfillState,
};

export default BackfillTrusteeAppointmentsDownstream;
