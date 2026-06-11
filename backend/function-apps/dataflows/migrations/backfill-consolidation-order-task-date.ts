import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import {
  buildFunctionName,
  buildQueueName,
  CursorMessage,
  StartMessage,
} from '../dataflows-common';
import BackfillConsolidationOrderTaskDateUseCase from '../../../lib/use-cases/dataflows/backfill-consolidation-order-task-date';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.BACKFILL_CONSOLIDATION_ORDER_TASK_DATE;
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
  context.logger.info(MODULE_NAME, 'Starting consolidation order taskDate backfill migration.');
  const cursorMessage: CursorMessage = { lastId: null };
  invocationContext.extraOutputs.set(PAGE, cursorMessage);
}

async function handlePage(cursor: CursorMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const result = await BackfillConsolidationOrderTaskDateUseCase.processBackfillPage(
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
    logger.info(MODULE_NAME, 'No more consolidation orders to backfill. Migration complete.');
    return;
  }

  const { failedResults, successCount, processedCount, nextCursor } = result;

  if (failedResults.length > 0) {
    logger.warn(MODULE_NAME, `${failedResults.length} consolidation orders failed to backfill.`);
  }

  logger.debug(
    MODULE_NAME,
    `Successfully backfilled ${successCount} of ${processedCount} consolidation orders.`,
  );

  if (nextCursor) {
    invocationContext.extraOutputs.set(PAGE, nextCursor);
  } else {
    logger.info(
      MODULE_NAME,
      `Consolidation order taskDate backfill complete. Total processed: ${processedCount}.`,
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
