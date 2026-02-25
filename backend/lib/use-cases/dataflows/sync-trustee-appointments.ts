import { ApplicationContext } from '../../adapters/types/basic';
import {
  TRUSTEE_APPOINTMENT_SYNC_ERROR_CODES,
  TrusteeAppointmentSyncError,
  TrusteeAppointmentSyncErrorCode,
  TrusteeAppointmentSyncEvent,
  CandidateScore,
} from '@common/cams/dataflow-events';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsError } from '../../common-errors/cams-error';
import { isNotFoundError } from '../../common-errors/not-found-error';
import { TrusteeAppointmentsSyncState } from '../gateways.types';
import { matchTrusteeByName, resolveTrusteeWithFuzzyMatching } from './trustee-match.helpers';
import { randomUUID } from 'node:crypto';

const MODULE_NAME = 'SYNC-TRUSTEE-APPOINTMENTS-USE-CASE';

type ProcessAppointmentsResult = {
  successCount: number;
  dlqMessages: (TrusteeAppointmentSyncError | TrusteeAppointmentSyncEvent)[];
};

/**
 * Type predicate to check if error data is a MULTIPLE_TRUSTEES_MATCH error.
 */
function isMultipleTrusteesMatchError(
  data: unknown,
): data is { mismatchReason: 'MULTIPLE_TRUSTEES_MATCH'; candidateTrusteeIds: string[] } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'mismatchReason' in data &&
    (data as { mismatchReason: unknown }).mismatchReason ===
      TRUSTEE_APPOINTMENT_SYNC_ERROR_CODES.MULTIPLE_TRUSTEES_MATCH &&
    'candidateTrusteeIds' in data
  );
}

/**
 * Classify a caught error into a DLQ message.
 * Known permanent errors become typed TrusteeAppointmentSyncError with a mismatchReason.
 * Unclassified/transient errors fall back to the raw event shape with error set.
 */
function buildDlqMessage(
  event: TrusteeAppointmentSyncEvent,
  error: CamsError,
): TrusteeAppointmentSyncError | TrusteeAppointmentSyncEvent {
  const DEFAULT_MESSAGE = { ...event, error };
  const { data } = error;
  if (!data) {
    if (isNotFoundError(error)) {
      return { ...event, mismatchReason: TRUSTEE_APPOINTMENT_SYNC_ERROR_CODES.CASE_NOT_FOUND };
    }

    return DEFAULT_MESSAGE;
  }

  const { mismatchReason, candidateTrusteeIds, candidateScores } = data as {
    mismatchReason?: TrusteeAppointmentSyncErrorCode;
    candidateTrusteeIds?: string[];
    candidateScores?: CandidateScore[];
  };

  if (mismatchReason === TRUSTEE_APPOINTMENT_SYNC_ERROR_CODES.NO_TRUSTEE_MATCH) {
    return { ...event, mismatchReason: TRUSTEE_APPOINTMENT_SYNC_ERROR_CODES.NO_TRUSTEE_MATCH };
  }

  if (mismatchReason === TRUSTEE_APPOINTMENT_SYNC_ERROR_CODES.MULTIPLE_TRUSTEES_MATCH) {
    return {
      ...event,
      mismatchReason: TRUSTEE_APPOINTMENT_SYNC_ERROR_CODES.MULTIPLE_TRUSTEES_MATCH,
      candidateTrusteeIds,
      candidateScores,
    };
  }

  return DEFAULT_MESSAGE;
}

/**
 * Get trustee appointment events from DXTR.
 * Queries for trustee appointment transactions and returns events with party data.
 * Throws error on failure to allow caller to route to DLQ.
 */
async function getAppointmentEvents(context: ApplicationContext, lastSyncDate?: string) {
  try {
    let syncState: TrusteeAppointmentsSyncState;
    if (lastSyncDate) {
      syncState = {
        id: randomUUID(),
        documentType: 'TRUSTEE_APPOINTMENTS_SYNC_STATE',
        lastSyncDate,
      };
    } else {
      const runtimeStateRepo = factory.getTrusteeAppointmentsSyncStateRepo(context);
      syncState = await runtimeStateRepo.read('TRUSTEE_APPOINTMENTS_SYNC_STATE');
    }

    const casesGateway = factory.getCasesGateway(context);
    const { events, latestSyncDate } = await casesGateway.getTrusteeAppointments(
      context,
      syncState.lastSyncDate,
    );

    return {
      events,
      latestSyncDate,
    };
  } catch (originalError) {
    const error = getCamsError(originalError, MODULE_NAME);
    context.logger.camsError(error);
    throw error;
  }
}

/**
 * Process trustee appointment events by:
 * 1. Matching each DXTR trustee to a CAMS trustee by name
 * 2. Updating the SyncedCase with the matched trusteeId
 */
async function processAppointments(
  context: ApplicationContext,
  events: TrusteeAppointmentSyncEvent[],
): Promise<ProcessAppointmentsResult> {
  const casesRepo = factory.getCasesRepository(context);
  const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);
  const dlqMessages: (TrusteeAppointmentSyncError | TrusteeAppointmentSyncEvent)[] = [];
  let successCount = 0;

  for (const event of events) {
    try {
      // Match DXTR trustee name to CAMS trustee
      const trusteeId = await matchTrusteeByName(context, event.dxtrTrustee.fullName);
      const now = new Date().toISOString();

      // Update the SyncedCase with the matched trusteeId
      const syncedCase = await casesRepo.getSyncedCase(event.caseId);
      if (syncedCase && syncedCase.trusteeId !== trusteeId) {
        syncedCase.trusteeId = trusteeId;
        await casesRepo.syncDxtrCase(syncedCase);
        context.logger.info(
          MODULE_NAME,
          `Linked case ${event.caseId} to trustee ${trusteeId} (matched name: "${event.dxtrTrustee.fullName}")`,
        );
      }

      // Manage CASE_APPOINTMENT history
      const existingAppointment = await appointmentsRepo.getActiveCaseAppointment(event.caseId);

      if (existingAppointment && existingAppointment.trusteeId === trusteeId) {
        // Same trustee already active — skip
        successCount++;
        continue;
      }

      if (existingAppointment && existingAppointment.trusteeId !== trusteeId) {
        // Different trustee — soft-close old appointment
        await appointmentsRepo.updateCaseAppointment({
          ...existingAppointment,
          unassignedOn: now,
        });
        context.logger.info(
          MODULE_NAME,
          `Soft-closed case appointment for case ${event.caseId}, old trustee ${existingAppointment.trusteeId}`,
        );
      }

      // Create new CASE_APPOINTMENT
      await appointmentsRepo.createCaseAppointment({
        caseId: event.caseId,
        trusteeId,
        assignedOn: now,
      });
      context.logger.info(
        MODULE_NAME,
        `Created case appointment for case ${event.caseId}, trustee ${trusteeId}`,
      );
      successCount++;
    } catch (originalError) {
      const camsError = getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to process trustee appointment for case ${event.caseId}.`,
      );

      // Check if it's a MULTIPLE_TRUSTEES_MATCH error
      if (isMultipleTrusteesMatchError(camsError.data)) {
        try {
          // Attempt fuzzy matching resolution
          const trusteeId = await resolveTrusteeWithFuzzyMatching(
            context,
            event,
            camsError.data.candidateTrusteeIds,
          );

          // If fuzzy matching succeeds, continue with normal success flow
          const now = new Date().toISOString();

          // Update SyncedCase
          const syncedCase = await casesRepo.getSyncedCase(event.caseId);
          if (syncedCase && syncedCase.trusteeId !== trusteeId) {
            syncedCase.trusteeId = trusteeId;
            await casesRepo.syncDxtrCase(syncedCase);
            context.logger.info(
              MODULE_NAME,
              `Linked case ${event.caseId} to trustee ${trusteeId} via fuzzy matching`,
            );
          }

          // Manage CASE_APPOINTMENT history
          const existingAppointment = await appointmentsRepo.getActiveCaseAppointment(event.caseId);

          if (existingAppointment && existingAppointment.trusteeId === trusteeId) {
            successCount++;
            continue;
          }

          if (existingAppointment && existingAppointment.trusteeId !== trusteeId) {
            await appointmentsRepo.updateCaseAppointment({
              ...existingAppointment,
              unassignedOn: now,
            });
            context.logger.info(
              MODULE_NAME,
              `Soft-closed case appointment for case ${event.caseId}, old trustee ${existingAppointment.trusteeId}`,
            );
          }

          await appointmentsRepo.createCaseAppointment({
            caseId: event.caseId,
            trusteeId,
            assignedOn: now,
          });
          context.logger.info(
            MODULE_NAME,
            `Created case appointment for case ${event.caseId}, trustee ${trusteeId} (fuzzy match)`,
          );
          successCount++;
          continue;
        } catch (fuzzyError) {
          // Fuzzy matching failed, proceed to DLQ with enhanced error
          const enhancedError = getCamsError(
            fuzzyError,
            MODULE_NAME,
            `Fuzzy matching failed for case ${event.caseId}.`,
          );
          context.logger.warn(MODULE_NAME, `${enhancedError.message}`, enhancedError.data);
          dlqMessages.push(buildDlqMessage(event, enhancedError));
          continue;
        }
      }

      // Existing error handling for other error types
      context.logger.warn(MODULE_NAME, `${camsError}`);
      dlqMessages.push(buildDlqMessage(event, camsError));
    }
  }

  return { successCount, dlqMessages };
}

/**
 * Store the runtime state after successful sync.
 */
async function storeRuntimeState(context: ApplicationContext, lastSyncDate: string) {
  const runtimeStateRepo = factory.getTrusteeAppointmentsSyncStateRepo(context);
  try {
    const newSyncState: TrusteeAppointmentsSyncState = {
      documentType: 'TRUSTEE_APPOINTMENTS_SYNC_STATE',
      lastSyncDate,
    };
    await runtimeStateRepo.upsert(newSyncState);
    context.logger.info(MODULE_NAME, `Wrote runtime state: `, newSyncState);
  } catch (originalError) {
    const error = getCamsError(
      originalError,
      MODULE_NAME,
      'Failed while storing the trustee appointments sync runtime state.',
    );
    context.logger.camsError(error);
  }
}

const SyncTrusteeAppointments = {
  getAppointmentEvents,
  processAppointments,
  storeRuntimeState,
};

export default SyncTrusteeAppointments;
