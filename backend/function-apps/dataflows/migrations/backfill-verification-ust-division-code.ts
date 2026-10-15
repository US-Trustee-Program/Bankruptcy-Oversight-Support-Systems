import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import {
  buildFunctionName,
  buildQueueName,
  CursorMessage,
  StartMessage,
} from '../dataflows-common';
import BackfillVerificationUstDivisionCodeUseCase from '../../../lib/use-cases/dataflows/backfill-verification-ust-division-code';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.BACKFILL_VERIFICATION_UST_DIVISION_CODE;
const PAGE_SIZE = 100;

const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: STORAGE_QUEUE_CONNECTION,
});

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

async function handleStart(_ignore: StartMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  context.logger.info(
    MODULE_NAME,
    'Starting trustee match verification ustDivisionCode backfill migration.',
  );
  const cursorMessage: CursorMessage = { lastId: null };
  invocationContext.extraOutputs.set(PAGE, cursorMessage);
}

async function handlePage(cursor: CursorMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const result = await BackfillVerificationUstDivisionCodeUseCase.processBackfillPage(
    context,
    cursor.lastId,
    PAGE_SIZE,
  );

  if (result.status === 'error') {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(result.error, MODULE_NAME, HANDLE_PAGE),
    );
    return;
  }

  if (result.status === 'empty') {
    logger.info(MODULE_NAME, 'No more verifications to backfill. Migration complete.');
    return;
  }

  const { failedResults, successCount, skippedCount, processedCount, nextCursor } = result;

  if (failedResults.length > 0) {
    logger.warn(MODULE_NAME, `${failedResults.length} trustee verifications failed to backfill.`);
  }

  // Skips mean the case had no ustDivisionCode to copy, which is expected if
  // BACKFILL-UST-DIVISION-CODE has not finished. They stay selectable by the page query, so a
  // later re-run picks them up.
  if (skippedCount > 0) {
    logger.warn(
      MODULE_NAME,
      `${skippedCount} verifications skipped because their synced case has no ustDivisionCode. ` +
        'Re-run this migration after BACKFILL-UST-DIVISION-CODE reaches COMPLETED.',
    );
  }

  logger.debug(
    MODULE_NAME,
    `Successfully backfilled ${successCount} of ${processedCount} trustee verifications.`,
  );

  if (nextCursor) {
    invocationContext.extraOutputs.set(PAGE, nextCursor);
  } else {
    logger.info(
      MODULE_NAME,
      `Trustee verification ustDivisionCode backfill complete. Total processed: ${processedCount}.`,
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
