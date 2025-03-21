import { InvocationContext } from '@azure/functions/types/InvocationContext';
import { CaseNotesUseCase } from '../../../lib/use-cases/case-notes/case-notes';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import ContextCreator from '../../azure/application-context-creator';
import { buildFunctionName, buildQueueName, StartMessage } from '../dataflows-common';
import { output } from '@azure/functions';

const MODULE_NAME = 'SYNC-CASES';
const PAGE_SIZE = 100;

// Queues
const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: 'AzureWebJobsStorage',
});

const PAGE = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'page'),
  connection: 'AzureWebJobsStorage',
});

const DLQ = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'dlq'),
  connection: 'AzureWebJobsStorage',
});

const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');

async function handleStart(_ignore: StartMessage, invocationContext: InvocationContext) {
  try {
    const context = await ContextCreator.getApplicationContext({ invocationContext });
    const useCase = new CaseNotesUseCase(context);
    await useCase.migrateLegacyCaseNotesPage({ limit: PAGE_SIZE, offset: 0 });

    let start = 0;
    let end = 0;

    const pages = [];
    while (end < events.length) {
      start = end;
      end += PAGE_SIZE;
      pages.push(events.slice(start, end));
    }
    invocationContext.extraOutputs.set(PAGE, pages);

    await useCase.updateLegacyCaseNote(context, newNote);
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
    extraOutputs: [DLQ, PAGE],
    handler: handleStart,
  });

  app.storageQueue(HANDLE_PAGE, {
    connection: 'AzureWebJobsStorage',
    queueName: PAGE.queueName,
    extraOutputs: [DLQ],
    handler: handlePage,
  });
}

export default {
  MODULE_NAME,
  setup,
};
