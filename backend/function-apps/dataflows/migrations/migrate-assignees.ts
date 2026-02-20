import { app, InvocationContext, output } from '@azure/functions';
import { buildFunctionName, buildQueueName, StartMessage } from '../dataflows-common';
import ContextCreator from '../../azure/application-context-creator';
import MigrateOfficeAssigneesUseCase from '../../../lib/use-cases/dataflows/migrate-office-assignees';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';

const MODULE_NAME = 'MIGRATE-ASSIGNEES';

const START_FUNCTION = buildFunctionName(MODULE_NAME, 'start');
const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: STORAGE_QUEUE_CONNECTION,
});

async function start(_ignore: StartMessage, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(invocationContext.invocationId);
  try {
    const summary = await MigrateOfficeAssigneesUseCase.migrateAssignments(context);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'start', context.logger, {
      documentsWritten: summary.success,
      documentsFailed: summary.fail,
      success: true,
    });
  } catch (originalError) {
    const error = getCamsError(originalError, MODULE_NAME, 'Failed to migrate office assignees.');
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'start', context.logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: error.message,
    });
    context.logger.camsError(error);
    throw error;
  }
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
