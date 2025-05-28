// TODO: Delete this module once the consolidation order `consolidationId` values have been migrated.

import { app, InvocationContext, output } from '@azure/functions';
import { buildFunctionName, buildQueueName, StartMessage } from '../dataflows-common';
import ContextCreator from '../../azure/application-context-creator';
import { STORAGE_QUEUE_CONNECTION } from '../storage-queues';
import MigrateOrderIdsUseCase from '../../../lib/use-cases/dataflows/migrate-order-ids';
import { MigrationConsolidationOrder } from '../../../lib/use-cases/gateways.types';

const MODULE_NAME = 'MIGRATE-ORDER-IDS';

const START_FUNCTION = buildFunctionName(MODULE_NAME, 'start');
const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const UPDATE_FUNCTION = buildFunctionName(MODULE_NAME, 'update');
const UPDATE = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'update'),
  connection: STORAGE_QUEUE_CONNECTION,
});

async function start(_ignore: StartMessage, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  try {
    const orderSets = await MigrateOrderIdsUseCase.migrateConsolidationOrderIds(context);
    invocationContext.extraOutputs.set(UPDATE, orderSets);
  } catch (error) {
    invocationContext.log(error);
  }
}

async function update(orders: MigrationConsolidationOrder[], invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  await MigrateOrderIdsUseCase.updateConsolidationIds(context, orders);
}

function setup() {
  app.storageQueue(START_FUNCTION, {
    connection: START.connection,
    queueName: START.queueName,
    handler: start,
    extraOutputs: [UPDATE],
  });
  app.storageQueue(UPDATE_FUNCTION, {
    connection: UPDATE.connection,
    queueName: UPDATE.queueName,
    handler: update,
  });
}

const MigrateOrderIds = {
  MODULE_NAME,
  setup,
};

export default MigrateOrderIds;
