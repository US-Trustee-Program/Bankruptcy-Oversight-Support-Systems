import { app, InvocationContext, output } from '@azure/functions';
import { getCaseNumber } from '@common/cams/cases';

import ApplicationContextCreator from '../../azure/application-context-creator';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import { buildFunctionName, buildQueueName } from '../dataflows-common';
import {
  DivisionChangeCleanupUseCase,
  OrphanedCaseMessage,
} from '../../../lib/use-cases/dataflows/division-change-cleanup';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import { filterToExtendedAscii } from '@common/cams/sanitization';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';

const MODULE_NAME = 'DIVISION-CHANGE-CLEANUP-MIGRATION';

const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: STORAGE_QUEUE_CONNECTION,
});

export const FIX_QUEUE_NAME = buildQueueName(MODULE_NAME, 'fix');

const FIX = output.storageQueue({
  queueName: FIX_QUEUE_NAME,
  connection: STORAGE_QUEUE_CONNECTION,
});

const DLQ = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'dlq'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_FIX = buildFunctionName(MODULE_NAME, 'handleFix');
const HANDLE_FIX_POISON = buildFunctionName(MODULE_NAME, 'handleFixPoison');

async function handleStart(
  _message: Record<string, unknown>,
  invocationContext: InvocationContext,
) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    const fixMessages = await DivisionChangeCleanupUseCase.findOrphanedCasePairs(context);
    invocationContext.extraOutputs.set(FIX, fixMessages);

    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { fixMessagesQueued: String(fixMessages.length) },
    });
  } catch (originalError) {
    logger.error(MODULE_NAME, `Start handler failed: ${(originalError as Error).message}`);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: (originalError as Error).message,
    });
    throw originalError;
  }
}

async function handleFix(message: OrphanedCaseMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    const { orphanedCaseId, currentCaseId } = message;

    const caseNumber = getCaseNumber(orphanedCaseId);
    logger.info(
      MODULE_NAME,
      `Fixing orphaned case ${filterToExtendedAscii(orphanedCaseId)} (${caseNumber}) -> ${filterToExtendedAscii(currentCaseId)}`,
    );

    const documentsWritten = await DivisionChangeCleanupUseCase.cleanupOrphanedCase(
      context,
      orphanedCaseId,
      currentCaseId,
    );

    logger.info(MODULE_NAME, `Cleanup completed for ${filterToExtendedAscii(orphanedCaseId)}`);

    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleFix', logger, {
      documentsWritten,
      documentsFailed: 0,
      success: true,
      details: {
        orphanedCaseId: filterToExtendedAscii(orphanedCaseId),
        currentCaseId: filterToExtendedAscii(currentCaseId),
      },
    });
  } catch (originalError) {
    logger.error(MODULE_NAME, `Fix handler failed: ${(originalError as Error).message}`);
    invocationContext.extraOutputs.set(DLQ, [
      buildQueueError(originalError, MODULE_NAME, HANDLE_FIX),
    ]);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleFix', logger, {
      documentsWritten: 0,
      documentsFailed: 1,
      success: false,
      error: (originalError as Error).message,
    });
    throw originalError;
  }
}

async function handleFixPoison(
  message: Record<string, unknown>,
  invocationContext: InvocationContext,
) {
  const logger = ApplicationContextCreator.getLogger(invocationContext);
  logger.error(
    MODULE_NAME,
    `Poison message received on fix queue: ${JSON.stringify(buildQueueError(getCamsError(new Error('Poison message'), MODULE_NAME), MODULE_NAME, HANDLE_FIX))}`,
  );
  logger.error(MODULE_NAME, `Poison message payload: ${JSON.stringify(message)}`);
}

function setup() {
  app.storageQueue(HANDLE_START, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: START.queueName,
    handler: handleStart,
    extraOutputs: [FIX],
  });

  app.storageQueue(HANDLE_FIX, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: FIX.queueName,
    handler: handleFix,
    extraOutputs: [DLQ],
  });

  app.storageQueue(HANDLE_FIX_POISON, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: `${FIX.queueName}-poison`,
    handler: handleFixPoison,
  });
}

export { handleStart, handleFix, handleFixPoison };

export default {
  MODULE_NAME,
  setup,
};
