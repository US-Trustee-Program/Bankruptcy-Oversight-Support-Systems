import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import {
  buildFunctionName,
  buildQueueName,
  buildStartQueueHttpTrigger,
  StartMessage,
} from '../dataflows-common';
import BackfillTrusteePhoneticTokensUseCase from '../../../lib/use-cases/dataflows/backfill-trustee-phonetic-tokens';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.BACKFILL_TRUSTEE_PHONETIC_TOKENS;

// Queues
const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const DLQ = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'dlq'),
  connection: STORAGE_QUEUE_CONNECTION,
});

// Registered function names
const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HTTP_TRIGGER = buildFunctionName(MODULE_NAME, 'httpTrigger');

/**
 * handleStart
 *
 * Fetch all trustees needing phonetic token backfill and process them in a single pass.
 * The trustee collection is small enough that cursor-based pagination is not needed.
 */
async function handleStart(_ignore: StartMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  // Get trustees that need backfill
  const trusteesResult =
    await BackfillTrusteePhoneticTokensUseCase.getTrusteesNeedingBackfill(context);

  if (trusteesResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(trusteesResult.error, MODULE_NAME, HANDLE_START),
    );
    return;
  }

  const trustees = trusteesResult.data ?? [];

  if (trustees.length === 0) {
    logger.info(MODULE_NAME, 'All trustees already have phonetic tokens. Nothing to backfill.');
    return;
  }

  logger.info(MODULE_NAME, `Backfilling phonetic tokens for ${trustees.length} trustees.`);

  // Process all trustees
  const backfillResult = await BackfillTrusteePhoneticTokensUseCase.backfillTokensForTrustees(
    context,
    trustees,
  );

  if (backfillResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(backfillResult.error, MODULE_NAME, HANDLE_START),
    );
    return;
  }

  const results = backfillResult.data ?? [];
  const successCount = results.filter((r) => r.success).length;
  const failedResults = results.filter((r) => !r.success);

  if (failedResults.length > 0) {
    logger.warn(
      MODULE_NAME,
      `${failedResults.length} trustees failed to backfill: ${failedResults.map((r) => r.trusteeId).join(', ')}`,
    );
    invocationContext.extraOutputs.set(
      DLQ,
      failedResults.map((r) => ({ trusteeId: r.trusteeId, error: r.error })),
    );
  }

  logger.info(
    MODULE_NAME,
    `Trustee phonetic token backfill complete. Success: ${successCount}, Failed: ${failedResults.length}.`,
  );
}

function setup() {
  app.storageQueue(HANDLE_START, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: START.queueName,
    handler: handleStart,
    extraOutputs: [DLQ],
  });

  app.http(HTTP_TRIGGER, {
    route: 'backfill-trustee-phonetic-tokens',
    methods: ['POST'],
    extraOutputs: [START],
    handler: buildStartQueueHttpTrigger(MODULE_NAME, START),
  });
}

export default {
  MODULE_NAME,
  setup,
};
