import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import {
  buildFunctionName,
  buildQueueName,
  CursorMessage,
  StartMessage,
} from '../dataflows-common';
import BackfillTrusteeAppointmentsDownstream from '../../../lib/use-cases/dataflows/backfill-trustee-appointments-downstream';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.BACKFILL_TRUSTEE_APPOINTMENTS_DOWNSTREAM;
const PAGE_SIZE = 100;

const PAGE = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'page'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const DLQ = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'dlq'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');

/**
 * handleStart
 *
 * Triggered by enqueuing a message to the start queue via Azure Storage Explorer or az CLI.
 * Initializes the backfill migration by reading existing state for resumability.
 * If the feature flag is off, logs and returns early.
 * If already completed, skips. Otherwise, queues first/next CursorMessage with lastId from state.
 */
export async function handleStart(_ignore: StartMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  if (!context.featureFlags['downstream-trustee-appointments-enabled']) {
    logger.info(
      MODULE_NAME,
      'downstream-trustee-appointments-enabled flag is off — skipping backfill',
    );
    return;
  }

  const stateResult = await BackfillTrusteeAppointmentsDownstream.readBackfillState(context);

  if (stateResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(stateResult.error, MODULE_NAME, HANDLE_START),
    );
    return;
  }

  const existingState = stateResult.data;

  if (existingState?.status === 'COMPLETED') {
    logger.info(
      MODULE_NAME,
      `Backfill already completed at ${existingState.lastUpdatedAt}. Processed ${existingState.processedCount} appointments. Skipping.`,
    );
    return;
  }

  const lastId = existingState?.lastId ?? null;
  const processedCount = existingState?.processedCount ?? 0;

  if (existingState) {
    logger.info(
      MODULE_NAME,
      `Resuming backfill from cursor ${lastId}. Already processed ${processedCount} appointments.`,
    );
  } else {
    logger.info(MODULE_NAME, 'Starting fresh trustee appointments downstream backfill.');
  }

  const cursorMessage: CursorMessage = { lastId };
  invocationContext.extraOutputs.set(PAGE, cursorMessage);
}

/**
 * handlePage
 *
 * Process a page of CaseAppointment records using cursor-based pagination.
 * Fetches page using cursor, queues downstream events for each appointment, updates state.
 * If hasMore, queues next CursorMessage. If no more results, sets status to COMPLETED.
 */
export async function handlePage(cursor: CursorMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const stateResult = await BackfillTrusteeAppointmentsDownstream.readBackfillState(context);
  if (stateResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(stateResult.error, MODULE_NAME, HANDLE_PAGE),
    );
    return;
  }

  const currentProcessedCount = stateResult.data?.processedCount ?? 0;

  const pageResult = await BackfillTrusteeAppointmentsDownstream.getPageOfAppointments(
    context,
    cursor.lastId,
    PAGE_SIZE,
  );

  if (pageResult.error || !pageResult.data) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(
        pageResult.error ??
          new CamsError(MODULE_NAME, { message: 'Unexpected missing data in page result' }),
        MODULE_NAME,
        HANDLE_PAGE,
      ),
    );
    return;
  }

  const { appointments, lastId: newLastId, hasMore } = pageResult.data;

  if (appointments.length === 0) {
    logger.info(MODULE_NAME, 'No more appointments to backfill. Migration complete.');
    await BackfillTrusteeAppointmentsDownstream.updateBackfillState(context, {
      lastId: cursor.lastId,
      processedCount: currentProcessedCount,
      status: 'COMPLETED',
    });
    return;
  }

  const processResult = await BackfillTrusteeAppointmentsDownstream.processAppointmentsPage(
    context,
    appointments,
  );

  if (processResult.error) {
    await BackfillTrusteeAppointmentsDownstream.updateBackfillState(context, {
      lastId: cursor.lastId,
      processedCount: currentProcessedCount,
      status: 'FAILED',
    });
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(processResult.error, MODULE_NAME, HANDLE_PAGE),
    );
    return;
  }

  const { successCount } = processResult.data ?? { successCount: 0 };
  const newProcessedCount = currentProcessedCount + successCount;

  const updateResult = await BackfillTrusteeAppointmentsDownstream.updateBackfillState(context, {
    lastId: newLastId,
    processedCount: newProcessedCount,
    status: hasMore ? 'IN_PROGRESS' : 'COMPLETED',
  });

  if (updateResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(updateResult.error, MODULE_NAME, HANDLE_PAGE),
    );
    return;
  }

  logger.debug(MODULE_NAME, `Processed ${successCount} appointments. Total: ${newProcessedCount}.`);

  if (hasMore) {
    invocationContext.extraOutputs.set(PAGE, { lastId: newLastId } as CursorMessage);
  } else {
    logger.info(
      MODULE_NAME,
      `Backfill complete. Total processed: ${newProcessedCount} appointments.`,
    );
  }
}

function setup() {
  app.storageQueue(HANDLE_START, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: buildQueueName(MODULE_NAME, 'start'),
    handler: handleStart,
    extraOutputs: [PAGE, DLQ],
  });

  app.storageQueue(HANDLE_PAGE, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: PAGE.queueName,
    handler: handlePage,
    extraOutputs: [PAGE, DLQ],
  });
}

export default {
  MODULE_NAME,
  setup,
};
