import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeAppointmentSyncEvent } from '@common/cams/dataflow-events';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { TrusteeAppointmentsSyncState } from '../gateways.types';
import { matchTrusteeByName } from './trustee-match.helpers';
import { randomUUID } from 'node:crypto';

const MODULE_NAME = 'SYNC-TRUSTEE-APPOINTMENTS-USE-CASE';

/**
 * Get trustee appointment events from DXTR.
 * Queries for trustee appointment transactions and returns events with party data.
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
    return { events: [], latestSyncDate: undefined };
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
): Promise<TrusteeAppointmentSyncEvent[]> {
  const casesRepo = factory.getCasesRepository(context);

  for (const event of events) {
    try {
      // Match DXTR trustee name to CAMS trustee
      const trusteeId = await matchTrusteeByName(context, event.dxtrTrustee.fullName);

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
    } catch (originalError) {
      event.error = getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to process trustee appointment for case ${event.caseId}.`,
      );
      context.logger.warn(MODULE_NAME, `${event.error}`);
    }
  }

  return events;
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
