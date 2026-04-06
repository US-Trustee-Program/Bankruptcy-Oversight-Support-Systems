import { app, InvocationContext } from '@azure/functions';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { importZoomCsv } from '../../../lib/use-cases/dataflows/import-zoom-csv';
import { buildFunctionName, buildQueueName } from '../dataflows-common';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.IMPORT_ZOOM_CSV;

const START = buildQueueName(MODULE_NAME, 'start');
const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');

export async function handleStart(_message: unknown, invocationContext: InvocationContext) {
  const logger = ApplicationContextCreator.getLogger(invocationContext);
  try {
    const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
    const result = await importZoomCsv(context);
    logger.info(MODULE_NAME, `Import complete: ${JSON.stringify(result)}`);
  } catch (error) {
    logger.error(MODULE_NAME, 'Import failed', error);
  }
}

function setup() {
  app.storageQueue(HANDLE_START, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: START,
    handler: handleStart,
  });
}

const ImportZoomCsv = {
  MODULE_NAME,
  setup,
};

export default ImportZoomCsv;
