import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import {
  buildFunctionName,
  buildQueueName,
  CursorMessage,
  StartMessage,
} from '../dataflows-common';
import BackfillAppointmentUstDivisionCodesUseCase, {
  BackfillStartOptions,
} from '../../../lib/use-cases/dataflows/backfill-appointment-ust-division-codes';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.BACKFILL_APPOINTMENT_UST_DIVISION_CODES;
const PAGE_SIZE = 100;

// Queues
const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const PAGE = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'page'),
  connection: STORAGE_QUEUE_CONNECTION,
});

// Page-level failures only; per-appointment write failures are counted in the state document
// and logged. Re-running after a state reset retries them, since rewritten appointments carry
// an updatedOn later than the cutoff and drop out of the page query.
const DLQ = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'dlq'),
  connection: STORAGE_QUEUE_CONNECTION,
});

// Registered function names
const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');

/**
 * handleStart
 *
 * Remaps Eastern District of TN (court 0649) TRUSTEE_APPOINTMENT division codes from ACMS codes
 * (CS_DIV_ACMS) to bare codes (CS_DIV) — CAMS-936. Start message: `{ "cutoff": "<ISO timestamp>", "dryRun": false }`.
 * - cutoff (required for a fresh run): the time the CAMS-936 picker change was deployed.
 *   Appointments saved after it already hold bare codes and are left alone.
 * - dryRun (default true): log and count what would change without writing.
 */
async function handleStart(
  message: StartMessage & BackfillStartOptions,
  invocationContext: InvocationContext,
) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const result = await BackfillAppointmentUstDivisionCodesUseCase.startBackfill(context, {
    cutoff: message?.cutoff,
    dryRun: message?.dryRun,
  });

  if (result.status === 'error') {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(result.error, MODULE_NAME, HANDLE_START),
    );
    return;
  }

  if (result.status === 'invalid') {
    logger.error(MODULE_NAME, result.reason);
    return;
  }

  if (result.status === 'completed') {
    const { state } = result;
    logger.info(
      MODULE_NAME,
      `Backfill already completed at ${state.lastUpdatedAt} (cutoff ${state.cutoff}): ` +
        `${state.updatedCount} of ${state.processedCount} appointments updated, ` +
        `${state.ambiguousCount} ambiguous, ${state.failedCount} failed. ` +
        `Delete the ${state.documentType} document to run again. Skipping.`,
    );
    return;
  }

  logger.info(
    MODULE_NAME,
    result.lastId
      ? `Resuming appointment division code backfill from cursor ${result.lastId}.`
      : 'Starting appointment division code backfill.',
  );
  const cursorMessage: CursorMessage = { lastId: result.lastId };
  invocationContext.extraOutputs.set(PAGE, cursorMessage);
}

/**
 * handlePage
 *
 * Remaps one page of appointments. Delegates to processBackfillPage; handles queue I/O only.
 */
async function handlePage(cursor: CursorMessage, invocationContext: InvocationContext) {
  const startedAt = Date.now();
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const result = await BackfillAppointmentUstDivisionCodesUseCase.processBackfillPage(
    context,
    cursor.lastId,
    PAGE_SIZE,
    { startedAt },
  );

  if (result.status === 'error') {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(result.error, MODULE_NAME, HANDLE_PAGE),
    );
    return;
  }

  if (result.status === 'ok' && result.nextCursor) {
    invocationContext.extraOutputs.set(PAGE, result.nextCursor);
    return;
  }

  const stateResult = await BackfillAppointmentUstDivisionCodesUseCase.readBackfillState(context);
  const state = stateResult.data;
  if (state) {
    logger.info(
      MODULE_NAME,
      `Backfill ${state.dryRun ? 'dry run ' : ''}complete (${state.status}, cutoff ` +
        `${state.cutoff}): ${state.updatedCount} of ${state.processedCount} appointments ` +
        `${state.dryRun ? 'would be ' : ''}updated, ${state.ambiguousCount} ambiguous, ` +
        `${state.failedCount} failed.`,
    );
  }
}

function setup() {
  app.storageQueue(HANDLE_START, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: START.queueName,
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
