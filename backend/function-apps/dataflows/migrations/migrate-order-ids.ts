import { app, InvocationContext, output } from '@azure/functions';
import { buildFunctionName, buildQueueName, StartMessage } from '../dataflows-common';
import ContextCreator from '../../azure/application-context-creator';
import { STORAGE_QUEUE_CONNECTION } from '../storage-queues';
import MigrateOrderIdsUseCase from '../../../lib/use-cases/dataflows/migrate-order-ids';

const MODULE_NAME = 'MIGRATE-ORDER-IDS';

const START_FUNCTION = buildFunctionName(MODULE_NAME, 'start');
const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: STORAGE_QUEUE_CONNECTION,
});

async function start(_ignore: StartMessage, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  await MigrateOrderIdsUseCase.migrateOrderIds(context);
}

function setup() {
  app.storageQueue(START_FUNCTION, {
    connection: START.connection,
    queueName: START.queueName,
    handler: start,
  });
}

const MigrateOrderIds = {
  MODULE_NAME,
  setup,
};

export default MigrateOrderIds;
