import { app, InvocationContext, output } from '@azure/functions';
import { buildFunctionName, buildQueueName, StartMessage } from '../dataflows-common';
import ContextCreator from '../../azure/application-context-creator';
import MigrateOfficeAssigneesUseCase from '../../../lib/use-cases/dataflows/migrate-office-assignees';
import { STORAGE_QUEUE_CONNECTION } from '../storage-queues';

const MODULE_NAME = 'MIGRATE-ASSIGNEES';

const START_FUNCTION = buildFunctionName(MODULE_NAME, 'start');
const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: STORAGE_QUEUE_CONNECTION,
});

async function start(_ignore: StartMessage, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  await MigrateOfficeAssigneesUseCase.migrateAssignments(context);
}

function setup() {
  app.storageQueue(START_FUNCTION, {
    connection: START.connection,
    queueName: START.queueName,
    handler: start,
  });
}

const MigrateAssignees = {
  MODULE_NAME,
  setup,
};

export default MigrateAssignees;
