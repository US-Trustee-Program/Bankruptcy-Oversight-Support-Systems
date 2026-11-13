import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import { buildFunctionName, buildQueueName, StartMessage } from '../dataflows-common';
import CorrectTrusteeZoomPhonesUseCase, {
  CorrectionPassOutcome,
  CorrectionState,
  INITIAL_CORRECTION_STATE,
} from '../../../lib/use-cases/dataflows/correct-trustee-zoom-phones';
import { LoggerImpl } from '../../../lib/adapters/services/logger.service';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
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
 * Carried by a continuation message. A fresh run is an empty start message.
 */
export type CorrectTrusteeZoomPhonesMessage = StartMessage & { state?: CorrectionState };

// Delay before a continuation resumes, on top of the backoff the use case recommends.
const CONTINUATION_DELAY_SECONDS = 30;

/**
 * handleStart
 *
 * One-time correction of trustee Zoom phones stored in a format that fails PHONE_REGEX. A pass
 * backs off in place when Cosmos throttles it (429). If the backoff would not fit in the
 * invocation budget, the remaining work is handed to a continuation message on the start queue
 * that carries the state forward, rather than to the DLQ. Flagged trustees are listed in the
 * summary log and in a CSV report in object storage; only writes that failed for another reason
 * go to the DLQ.
 * Safe to re-run: phones already in the accepted format are left unchanged.
 */
async function handleStart(
  message: CorrectTrusteeZoomPhonesMessage,
  invocationContext: InvocationContext,
) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const outcome = await CorrectTrusteeZoomPhonesUseCase.runCorrectionPass(
    context,
    message.state ?? INITIAL_CORRECTION_STATE,
    { startedAt: Date.now() },
  );
  if (outcome.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(outcome.error, MODULE_NAME, HANDLE_START),
    );
    return;
  }

  if (outcome.data.kind === 'escape') {
    await enqueueContinuation(outcome.data, invocationContext, logger);
    return;
  }

  const { results, counts } = outcome.data.summary;

  const dlqMessages: unknown[] = results
    .filter((r) => r.outcome === 'failed')
    .map((r) => ({ trusteeId: r.trusteeId, error: r.error }));

  let reportLocation: string | undefined;
  try {
    reportLocation = await CorrectTrusteeZoomPhonesUseCase.writeFlaggedReport(context, results);
  } catch (originalError) {
    dlqMessages.push(buildQueueError(originalError, MODULE_NAME, HANDLE_START));
  }
  if (dlqMessages.length > 0) {
    invocationContext.extraOutputs.set(DLQ, dlqMessages);
  }

  // One trace for the whole run, so sampling keeps or drops the counts and the flagged list
  // together. Only ID and reason are logged; the report carries the name and stored phone.
  const flagged = results
    .filter((r) => r.outcome === 'flagged')
    .map((r) => `${r.trusteeId} (${r.reason})`);
  const flaggedList = flagged.length > 0 ? ` Flagged trustees: ${flagged.join(', ')}` : '';
  const reportNote = reportLocation ? ` Flagged report: ${reportLocation}` : '';
  logger.info(
    MODULE_NAME,
    `Trustee Zoom phone correction complete. Converted: ${counts.converted}, Already valid: ${counts.alreadyValid}, Flagged: ${counts.flagged}, Failed: ${counts.failed}.${flaggedList}${reportNote}`,
  );
}

async function enqueueContinuation(
  escape: Extract<CorrectionPassOutcome, { kind: 'escape' }>,
  invocationContext: InvocationContext,
  logger: LoggerImpl,
) {
  try {
    const connectionString = process.env.AzureWebJobsDataflowsStorage;
    if (!connectionString) {
      throw new Error('Missing required environment variable: AzureWebJobsDataflowsStorage');
    }
    const delaySeconds = CONTINUATION_DELAY_SECONDS + escape.backoffSeconds;
    const continuation: CorrectTrusteeZoomPhonesMessage = { state: escape.state };
    await StorageQueueHumbleObject.fromConnectionString(
      connectionString,
      START.queueName,
    ).sendMessage(JSON.stringify(continuation), delaySeconds);
    logger.info(
      MODULE_NAME,
      `Throttled past the invocation budget. Continuing in ${delaySeconds}s. Converted so far: ${escape.state.converted}.`,
    );
  } catch (originalError) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(originalError, MODULE_NAME, HANDLE_START),
    );
  }
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
