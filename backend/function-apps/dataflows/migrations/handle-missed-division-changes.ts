import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import { buildFunctionName, buildQueueName, buildStartQueueHttpTrigger } from '../dataflows-common';
import { handleRateLimitRetry } from '../dataflows-rate-limit';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { checkCaseForDivisionChange } from '../../../lib/use-cases/dataflows/handle-missed-division-changes';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { FIX_QUEUE_NAME } from './division-change-cleanup';
import factory from '../../../lib/factory';
import { filterToExtendedAscii } from '@common/cams/sanitization';

const MODULE_NAME = 'HANDLE-MISSED-DIVISION-CHANGES';

type CheckMessage = {
  caseId: string;
  retryCount?: number;
};

const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const CHECK = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'check'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const FIX = output.storageQueue({
  queueName: FIX_QUEUE_NAME,
  connection: STORAGE_QUEUE_CONNECTION,
});

const DLQ = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'dlq'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_CHECK = buildFunctionName(MODULE_NAME, 'handleCheck');
const HANDLE_CHECK_POISON = buildFunctionName(MODULE_NAME, 'handleCheckPoison');

const BLOB_CONTAINER = process.env.CAMS_OBJECT_CONTAINER ?? 'migration-files';
const BLOB_NAME = 'missed-division-change-case-ids.json';

async function handleStart(
  _message: Record<string, unknown>,
  invocationContext: InvocationContext,
) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    const objectStorage = factory.getObjectStorageGateway(context);
    const content = await objectStorage.readObject(BLOB_CONTAINER, BLOB_NAME);

    if (!content) {
      logger.warn(MODULE_NAME, `No blob found at ${BLOB_CONTAINER}/${BLOB_NAME} — nothing to do`);
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: true,
        details: { reason: 'no-blob' },
      });
      return;
    }

    const parsed: unknown = JSON.parse(content);
    if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== 'string')) {
      throw new Error(`Blob ${BLOB_CONTAINER}/${BLOB_NAME} does not contain a valid string array`);
    }
    const caseIds: string[] = parsed;
    const messages: CheckMessage[] = caseIds.map((caseId) => ({ caseId }));
    invocationContext.extraOutputs.set(CHECK, messages);

    logger.info(MODULE_NAME, `Queued ${messages.length} cases for division change check`);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { caseCount: String(caseIds.length) },
    });
  } catch (originalError) {
    logger.error(
      MODULE_NAME,
      `Start handler failed at ${BLOB_CONTAINER}/${BLOB_NAME}: ${(originalError as Error).message}`,
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: (originalError as Error).message,
    });
    throw originalError;
  }
}

async function handleCheck(message: CheckMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  const { caseId } = message;

  try {
    const divisionChange = await checkCaseForDivisionChange(context, caseId);
    if (divisionChange) {
      logger.info(
        MODULE_NAME,
        `Division change found: orphaned=${filterToExtendedAscii(divisionChange.orphanedCaseId)} current=${filterToExtendedAscii(divisionChange.currentCaseId)}`,
      );
      invocationContext.extraOutputs.set(FIX, [divisionChange]);
    }
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleCheck', logger, {
      documentsWritten: divisionChange ? 1 : 0,
      documentsFailed: 0,
      success: true,
      details: { caseId: filterToExtendedAscii(caseId), found: String(!!divisionChange) },
    });
  } catch (error) {
    const rateLimitRetryStatus = await handleRateLimitRetry({
      error,
      message,
      checkQueueName: CHECK.queueName,
      dlqOutput: DLQ,
      invocationContext,
      context,
      moduleName: MODULE_NAME,
      activityName: 'handleCheck',
      correlationId: caseId,
    });

    if (rateLimitRetryStatus === 'retried' || rateLimitRetryStatus === 'exhausted') {
      return;
    }

    logger.error(
      MODULE_NAME,
      `Failed to check case ${filterToExtendedAscii(caseId)}: ${(error as Error).message}`,
    );
    const queueError = buildQueueError(
      getCamsError(error as Error, MODULE_NAME, `Failed to check case ${caseId}`),
      MODULE_NAME,
      'handleCheck',
    );
    invocationContext.extraOutputs.set(DLQ, [
      {
        ...queueError,
        correlationId: caseId,
      },
    ]);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleCheck', logger, {
      documentsWritten: 0,
      documentsFailed: 1,
      success: false,
      error: (error as Error).message,
    });
    throw error;
  }
}

async function handleCheckPoison(
  message: Record<string, unknown>,
  invocationContext: InvocationContext,
) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  logger.error(MODULE_NAME, `Poison message on check queue: ${JSON.stringify(message)}`);
  invocationContext.extraOutputs.set(DLQ, [
    buildQueueError(
      getCamsError(new Error('poison-message'), MODULE_NAME, 'handleCheckPoison'),
      MODULE_NAME,
      'handleCheckPoison',
    ),
  ]);
  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleCheckPoison', logger, {
    documentsWritten: 0,
    documentsFailed: 1,
    success: false,
    error: 'poison-message',
  });
}

function setup() {
  app.http(HANDLE_START, {
    route: 'handle-missed-division-changes',
    methods: ['POST'],
    handler: buildStartQueueHttpTrigger(MODULE_NAME, START),
    extraOutputs: [START],
  });

  app.storageQueue(HANDLE_START, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: START.queueName,
    handler: handleStart,
    extraOutputs: [CHECK],
  });

  app.storageQueue(HANDLE_CHECK, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: CHECK.queueName,
    handler: handleCheck,
    extraOutputs: [FIX, DLQ],
  });

  app.storageQueue(HANDLE_CHECK_POISON, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: `${CHECK.queueName}-poison`,
    handler: handleCheckPoison,
    extraOutputs: [DLQ],
  });
}

const HandleMissedDivisionChanges = {
  MODULE_NAME,
  setup,
};

export { handleStart, handleCheck, handleCheckPoison };
export default HandleMissedDivisionChanges;
