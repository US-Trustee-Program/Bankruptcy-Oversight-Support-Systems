import { app, InvocationContext, output } from '@azure/functions';

import MigrateOfficeAssigneesUseCase from '../../../lib/use-cases/dataflows/migrate-office-assignees';
import ContextCreator from '../../azure/application-context-creator';
import { buildFunctionName, buildQueueName, StartMessage } from '../dataflows-common';
import { STORAGE_QUEUE_CONNECTION } from '../storage-queues';

const MODULE_NAME = 'MIGRATE-ASSIGNEES';

const START_FUNCTION = buildFunctionName(MODULE_NAME, 'start');
const START = output.storageQueue({
  connection: STORAGE_QUEUE_CONNECTION,
  queueName: buildQueueName(MODULE_NAME, 'start'),
});

function setup() {
  app.storageQueue(START_FUNCTION, {
    connection: START.connection,
    handler: start,
    queueName: START.queueName,
  });
}

async function start(_ignore: StartMessage, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  await MigrateOfficeAssigneesUseCase.migrateAssignments(context);
}

const MigrateAssignees = {
  MODULE_NAME,
  setup,
};

export default MigrateAssignees;
