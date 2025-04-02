import { app, InvocationContext } from '@azure/functions';
import { buildFunctionName, StartMessage } from '../dataflows-common';
import { MIGRATE_ASSIGNEES, MIGRATE_ASSIGNEES_START } from '../queue';
import ContextCreator from '../../azure/application-context-creator';

const MODULE_NAME = MIGRATE_ASSIGNEES;

const START = buildFunctionName(MODULE_NAME, 'start');

async function start(_ignore: StartMessage, invocationContext: InvocationContext) {
  const _context = await ContextCreator.getApplicationContext({ invocationContext });
  // const { logger } = context;

  // TODO: Implement the migration logic here.
  // get all active assignments
  //
}

function setup() {
  app.storageQueue(START, {
    connection: MIGRATE_ASSIGNEES_START.connection,
    queueName: MIGRATE_ASSIGNEES_START.queueName,
    handler: start,
    // extraOutputs: [HARD_STOP], // DO we need a DLQ??
  });
}

export default {
  MODULE_NAME,
  setup,
};
