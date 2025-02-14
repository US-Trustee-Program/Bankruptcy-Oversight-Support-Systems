import { app, InvocationContext, output } from '@azure/functions';
import { buildUniqueName } from '../dataflows-common';
import { CaseSyncEvent } from '../../../../common/src/queue/dataflow-types';
import ContextCreator from '../../azure/application-context-creator';
import ExportAndLoadCase from '../../../lib/use-cases/dataflows/export-and-load-case';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';

const MODULE_NAME = 'CASE_ETL';

const QUEUE = output.storageQueue({
  queueName: buildUniqueName(MODULE_NAME, 'queue').toLowerCase(),
  connection: 'AzureWebJobsStorage',
});

const FAILED = output.storageQueue({
  queueName: buildUniqueName(MODULE_NAME, 'failed').toLowerCase(),
  connection: 'AzureWebJobsStorage',
});

const PROCESS_QUEUE = buildUniqueName(MODULE_NAME, 'processQueue');
/**
 * processQueue
 *
 * @param event
 * @param invocationContext
 * @returns
 */
async function processQueue(event: CaseSyncEvent, invocationContext: InvocationContext) {
  try {
    const context = await ContextCreator.getApplicationContext({ invocationContext });

    const exportedCaseEvent = await ExportAndLoadCase.exportCase(context, event);
    if (exportedCaseEvent.error) throw exportedCaseEvent.error;

    const loadedCaseEvent = await ExportAndLoadCase.loadCase(context, exportedCaseEvent);
    if (loadedCaseEvent.error) throw loadedCaseEvent.error;

    return event;
  } catch (originalError) {
    invocationContext.extraOutputs.set(
      FAILED,
      buildQueueError(originalError, MODULE_NAME, PROCESS_QUEUE),
    );
  }
}

app.storageQueue(buildUniqueName(MODULE_NAME, 'processETL'), {
  queueName: QUEUE.queueName,
  connection: 'AzureWebJobsStorage',
  handler: processQueue,
  extraOutputs: [FAILED],
});

const CaseETL = {
  QUEUE,
};

export default CaseETL;
