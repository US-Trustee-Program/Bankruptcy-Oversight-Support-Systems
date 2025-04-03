import { app, InvocationContext } from '@azure/functions';
import { buildFunctionName, StartMessage } from '../dataflows-common';
import { MIGRATE_ASSIGNEES, MIGRATE_ASSIGNEES_START } from '../storage-queues';
import ContextCreator from '../../azure/application-context-creator';
import OfficeAssignees from '../../../lib/use-cases/dataflows/office-assignees';

const MODULE_NAME = MIGRATE_ASSIGNEES;

const START = buildFunctionName(MODULE_NAME, 'start');

async function start(_ignore: StartMessage, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  await OfficeAssignees.migrateAssignments(context);
}

function setup() {
  app.storageQueue(START, {
    connection: MIGRATE_ASSIGNEES_START.connection,
    queueName: MIGRATE_ASSIGNEES_START.queueName,
    handler: start,
  });
}

export default {
  MODULE_NAME,
  setup,
};
