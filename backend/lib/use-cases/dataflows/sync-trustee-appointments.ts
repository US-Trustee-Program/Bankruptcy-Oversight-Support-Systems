import { ApplicationContext } from '../../adapters/types/basic';
import {
  TrusteeAppointmentSyncError,
  TrusteeAppointmentSyncErrorCode,
  TrusteeAppointmentSyncEvent,
  CandidateScore,
  isMultipleTrusteesMatchError,
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
      return { ...event, mismatchReason: 'CASE_NOT_FOUND' };
    }

    return DEFAULT_MESSAGE;
  }

  const { mismatchReason, matchCandidates } = data as {
    mismatchReason?: TrusteeAppointmentSyncErrorCode;
    matchCandidates?: CandidateScore[];
  };

  if (mismatchReason === 'NO_TRUSTEE_MATCH') {
    return { ...event, mismatchReason: 'NO_TRUSTEE_MATCH', matchCandidates: [] };
  }

  if (mismatchReason === 'MULTIPLE_TRUSTEES_MATCH') {
    return {
      ...event,
      mismatchReason: 'MULTIPLE_TRUSTEES_MATCH',
      matchCandidates: matchCandidates || [],
    };
  }

  return DEFAULT_MESSAGE;
}

/**
 * Applies the resolved trustee to the case and manages appointment history.
 * Shared logic for both normal matching and fuzzy matching success paths.
 */
async function applyResolvedTrustee(
  context: ApplicationContext,
  event: TrusteeAppointmentSyncEvent,
  trusteeId: string,
  casesRepo: CasesRepository,
  appointmentsRepo: TrusteeAppointmentsRepository,
  viaFuzzyMatching: boolean = false,
): Promise<void> {
  const now = new Date().toISOString();

  const syncedCase = await casesRepo.getSyncedCase(event.caseId);
  if (syncedCase && syncedCase.trusteeId !== trusteeId) {
    syncedCase.trusteeId = trusteeId;
    await casesRepo.syncDxtrCase(syncedCase);
    const method = viaFuzzyMatching ? ' via fuzzy matching' : '';
    context.logger.info(
      MODULE_NAME,
      `Linked case ${event.caseId} to trustee ${trusteeId}${method}`,
    );
  }

  const existingAppointment = await appointmentsRepo.getActiveCaseAppointment(event.caseId);

  if (existingAppointment && existingAppointment.trusteeId === trusteeId) {
    return; // Same trustee already active — nothing to do
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
  const method = viaFuzzyMatching ? ' (fuzzy match)' : '';
  context.logger.info(
    MODULE_NAME,
    `Created case appointment for case ${event.caseId}, trustee ${trusteeId}${method}`,
  );
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
      const trusteeId = await matchTrusteeByName(context, event.dxtrTrustee.fullName);
      await applyResolvedTrustee(context, event, trusteeId, casesRepo, appointmentsRepo, false);
      successCount++;
    } catch (originalError) {
      const camsError = getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to process trustee appointment for case ${event.caseId}.`,
      );

      if (isMultipleTrusteesMatchError(camsError.data)) {
        try {
          const candidateTrusteeIds = camsError.data.matchCandidates.map((c) => c.trusteeId);
          const trusteeId = await resolveTrusteeWithFuzzyMatching(
            context,
            event,
            candidateTrusteeIds,
          );
          await applyResolvedTrustee(context, event, trusteeId, casesRepo, appointmentsRepo, true);
          successCount++;
          continue;
        } catch (fuzzyError) {
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
