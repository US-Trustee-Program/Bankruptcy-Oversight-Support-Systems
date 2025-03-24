import { InvocationContext } from '@azure/functions/types/InvocationContext';
import { CaseNotesUseCase } from '../../../lib/use-cases/case-notes/case-notes';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import ContextCreator from '../../azure/application-context-creator';
import { buildFunctionName, buildQueueName, StartMessage } from '../dataflows-common';
import { app, output } from '@azure/functions';

const MODULE_NAME = 'HANDLE-LEGACY-NOTES';
const PAGE_SIZE = 100;

// Queues
const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: 'AzureWebJobsStorage',
});

const DLQ = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'dlq'),
  connection: 'AzureWebJobsStorage',
});

const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');

async function handleStart(_ignore: StartMessage, invocationContext: InvocationContext) {
  try {
    const context = await ContextCreator.getApplicationContext({ invocationContext });
    const useCase = new CaseNotesUseCase(context);
    let offset = 0;
    const { metadata } = await useCase.migrateLegacyCaseNotesPage({ limit: PAGE_SIZE, offset });
    let executionTimes = Math.ceil(metadata.total / PAGE_SIZE) - 1;
    while (executionTimes > 0) {
      offset += PAGE_SIZE;
      await useCase.migrateLegacyCaseNotesPage({ limit: PAGE_SIZE, offset });
      executionTimes--;
    }
  } catch (originalError) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(originalError, MODULE_NAME, HANDLE_START),
    );
  }
}
function setup() {
  app.storageQueue(HANDLE_START, {
    connection: 'AzureWebJobsStorage',
    queueName: START.queueName,
    extraOutputs: [DLQ],
    handler: handleStart,
  });
}

export default {
  MODULE_NAME,
  setup,
};
