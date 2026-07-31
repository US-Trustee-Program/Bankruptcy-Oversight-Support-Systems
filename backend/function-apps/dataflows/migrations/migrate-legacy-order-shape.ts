import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import { buildFunctionName, buildQueueName, StartMessage } from '../dataflows-common';
import MigrateLegacyOrderShapeUseCase, {
  OrderKind,
} from '../../../lib/use-cases/dataflows/migrate-legacy-order-shape';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import { LoggerImpl } from '../../../lib/adapters/services/logger.service';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.MIGRATE_LEGACY_ORDER_SHAPE;
const PAGE_SIZE = 100;

const ORDER_KINDS: OrderKind[] = ['consolidation', 'transfer', 'trustee-match'];

type OrderShapeCursorMessage = {
  kind: OrderKind;
  lastId: string | null;
};

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
    'Starting legacy order shape migration (orderType → taskType, orderDate → taskDate).',
  );

  for (const kind of ORDER_KINDS) {
    const legacyCount = await MigrateLegacyOrderShapeUseCase.countLegacyOrders(context, kind);
    context.logger.info(MODULE_NAME, `${kind}: ${legacyCount} document(s) with legacy shape.`);
  }

  const cursorMessage: OrderShapeCursorMessage = { kind: ORDER_KINDS[0], lastId: null };
  invocationContext.extraOutputs.set(PAGE, cursorMessage);
}

async function handlePage(cursor: OrderShapeCursorMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const result = await MigrateLegacyOrderShapeUseCase.processMigrationPage(
    context,
    cursor.kind,
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
    advanceToNextKindOrComplete(cursor.kind, invocationContext, logger);
    return;
  }

  const { failedResults, successCount, processedCount, nextCursor } = result;

  if (failedResults.length > 0) {
    logger.warn(
      MODULE_NAME,
      `${failedResults.length} ${cursor.kind} orders failed to migrate to the new shape.`,
    );
  }

  logger.debug(
    MODULE_NAME,
    `Successfully migrated ${successCount} of ${processedCount} ${cursor.kind} orders.`,
  );

  if (nextCursor) {
    invocationContext.extraOutputs.set(PAGE, { kind: cursor.kind, lastId: nextCursor.lastId });
  } else {
    logger.info(
      MODULE_NAME,
      `${cursor.kind} order legacy shape migration complete. Total processed: ${processedCount}.`,
    );
    advanceToNextKindOrComplete(cursor.kind, invocationContext, logger);
  }
}

function advanceToNextKindOrComplete(
  completedKind: OrderKind,
  invocationContext: InvocationContext,
  logger: LoggerImpl,
) {
  const nextKind = ORDER_KINDS[ORDER_KINDS.indexOf(completedKind) + 1];
  if (nextKind) {
    invocationContext.extraOutputs.set(PAGE, { kind: nextKind, lastId: null });
    return;
  }
  logger.info(MODULE_NAME, 'Legacy order shape migration complete for all order kinds.');
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
