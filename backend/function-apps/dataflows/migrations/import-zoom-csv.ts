import { app, InvocationContext, output } from '@azure/functions';
import ApplicationContextCreator from '../../azure/application-context-creator';
import * as ImportZoomCsvUseCase from '../../../lib/use-cases/dataflows/import-zoom-csv';
import { ZoomCsvRow } from '../../../lib/use-cases/dataflows/import-zoom-csv';
import { buildFunctionName, buildQueueName } from '../dataflows-common';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.IMPORT_ZOOM_CSV;

type ZoomStartMessage = {
  csvUrl: string;
};

type ZoomCsvRowFailed = ZoomCsvRow & {
  reason: 'unmatched' | 'ambiguous' | 'error';
  retryCount?: number;
};

const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const ROW = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'row'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const RETRY = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'retry'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const HARD_STOP = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'hard-stop'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_ROW = buildFunctionName(MODULE_NAME, 'handleRow');
const HANDLE_RETRY = buildFunctionName(MODULE_NAME, 'handleRetry');

async function handleStart(message: ZoomStartMessage, invocationContext: InvocationContext) {
  const logger = ApplicationContextCreator.getLogger(invocationContext);

  let content: string;
  try {
    const response = await fetch(message.csvUrl);
    if (!response.ok) {
      logger.error(MODULE_NAME, `Failed to fetch CSV from ${message.csvUrl}: ${response.status}`);
      return;
    }
    content = await response.text();
  } catch (error) {
    logger.error(MODULE_NAME, `Network error fetching CSV from ${message.csvUrl}`, error);
    return;
  }

  const rows = ImportZoomCsvUseCase.parseZoomCsvFile(content);

  if (rows.length === 0) {
    logger.info(MODULE_NAME, 'No rows to process');
    return;
  }

  logger.info(MODULE_NAME, `Queuing ${rows.length} rows for processing`);
  invocationContext.extraOutputs.set(ROW, rows);
}

async function handleRow(row: ZoomCsvRow, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const outcome = await ImportZoomCsvUseCase.processZoomCsvRow(context, row);

  if (outcome === 'error') {
    invocationContext.extraOutputs.set(RETRY, { ...row, reason: outcome });
  } else if (outcome !== 'matched') {
    invocationContext.extraOutputs.set(HARD_STOP, { ...row, reason: outcome });
  }
}

async function handleRetry(row: ZoomCsvRowFailed, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const RETRY_LIMIT = 3;
  const retryCount = (row.retryCount ?? 0) + 1;

  if (retryCount > RETRY_LIMIT) {
    logger.info(MODULE_NAME, `Too many retry attempts for "${row.fullName}"`);
    invocationContext.extraOutputs.set(HARD_STOP, row);
    return;
  }

  const { reason: _reason, retryCount: _retryCount, ...csvRow } = row;
  const outcome = await ImportZoomCsvUseCase.processZoomCsvRow(context, csvRow);

  if (outcome === 'matched') {
    logger.info(MODULE_NAME, `Successfully retried row for "${row.fullName}"`);
  } else if (outcome === 'error') {
    invocationContext.extraOutputs.set(RETRY, { ...csvRow, reason: outcome, retryCount });
  } else {
    invocationContext.extraOutputs.set(HARD_STOP, { ...csvRow, reason: outcome, retryCount });
  }
}

function setup() {
  app.storageQueue(HANDLE_START, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: START.queueName,
    handler: handleStart,
    extraOutputs: [ROW],
  });

  app.storageQueue(HANDLE_ROW, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: ROW.queueName,
    handler: handleRow,
    extraOutputs: [RETRY, HARD_STOP],
  });

  app.storageQueue(HANDLE_RETRY, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: RETRY.queueName,
    handler: handleRetry,
    extraOutputs: [RETRY, HARD_STOP],
  });
}

const ImportZoomCsv = {
  MODULE_NAME,
  setup,
};

export default ImportZoomCsv;
