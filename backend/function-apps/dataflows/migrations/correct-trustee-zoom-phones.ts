import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import { buildFunctionName, buildQueueName, StartMessage } from '../dataflows-common';
import CorrectTrusteeZoomPhonesUseCase from '../../../lib/use-cases/dataflows/correct-trustee-zoom-phones';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.CORRECT_TRUSTEE_ZOOM_PHONES;

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

/**
 * handleStart
 *
 * One-time correction (CAMS-975) of trustee Zoom phones stored in a format that fails
 * PHONE_REGEX. Flagged trustees are listed in the summary log; failed writes go to the DLQ.
 * Safe to re-run: phones already in the accepted format are left unchanged.
 */
async function handleStart(_ignore: StartMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const trusteesResult = await CorrectTrusteeZoomPhonesUseCase.getTrusteesWithZoomInfo(context);
  if (trusteesResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(trusteesResult.error, MODULE_NAME, HANDLE_START),
    );
    return;
  }

  const correctionResult = await CorrectTrusteeZoomPhonesUseCase.correctZoomPhones(
    context,
    trusteesResult.data,
  );
  if (correctionResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(correctionResult.error, MODULE_NAME, HANDLE_START),
    );
    return;
  }

  const { results, counts } = correctionResult.data;

  const failed = results.filter((r) => r.outcome === 'failed');
  if (failed.length > 0) {
    invocationContext.extraOutputs.set(
      DLQ,
      failed.map((r) => ({ trusteeId: r.trusteeId, error: r.error })),
    );
  }

  // One trace for the whole run, so sampling keeps or drops the counts and the flagged list together.
  const flagged = results
    .filter((r) => r.outcome === 'flagged')
    .map((r) => `${r.trusteeId} (${r.reason})`);
  const flaggedList = flagged.length > 0 ? ` Flagged trustees: ${flagged.join(', ')}` : '';
  logger.info(
    MODULE_NAME,
    `Trustee Zoom phone correction complete. Converted: ${counts.converted}, Already valid: ${counts.alreadyValid}, Flagged: ${counts.flagged}, Failed: ${counts.failed}.${flaggedList}`,
  );
}

function setup() {
  app.storageQueue(HANDLE_START, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: START.queueName,
    handler: handleStart,
    extraOutputs: [DLQ],
  });
}

export { handleStart };
export default {
  MODULE_NAME,
  setup,
};
