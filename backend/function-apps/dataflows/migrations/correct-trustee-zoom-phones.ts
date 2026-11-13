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
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.CORRECT_TRUSTEE_ZOOM_PHONES;

// Queues
const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
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
 * that carries the state forward. There is no dead-letter queue: flagged trustees are listed in
 * the summary log and in a CSV report in object storage, and every failure is logged as an error
 * for App Insights.
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
    logger.error(MODULE_NAME, `Trustee Zoom phone correction failed. ${outcome.error.message}`);
    return;
  }

  if (outcome.data.kind === 'escape') {
    await enqueueContinuation(outcome.data, logger);
    return;
  }

  const { results, counts } = outcome.data.summary;

  let reportLocation: string | undefined;
  try {
    reportLocation = await CorrectTrusteeZoomPhonesUseCase.writeFlaggedReport(context, results);
  } catch (originalError) {
    logger.error(
      MODULE_NAME,
      `Flagged phones report could not be written. ${errorText(originalError)}`,
    );
  }

  // One trace for the whole run, so sampling keeps or drops the counts and the trustee lists
  // together. Only IDs and reasons are logged; the report carries the name and stored phone, and
  // each failed write also logged its own error.
  const failed = results.filter((r) => r.outcome === 'failed').map((r) => r.trusteeId);
  const failedList = failed.length > 0 ? ` Failed trustees: ${failed.join(', ')}` : '';
  const flagged = results
    .filter((r) => r.outcome === 'flagged')
    .map((r) => `${r.trusteeId} (${r.reason})`);
  const flaggedList = flagged.length > 0 ? ` Flagged trustees: ${flagged.join(', ')}` : '';
  const reportNote = reportLocation ? ` Flagged report: ${reportLocation}` : '';
  logger.info(
    MODULE_NAME,
    `Trustee Zoom phone correction complete. Converted: ${counts.converted}, Already valid: ${counts.alreadyValid}, Flagged: ${counts.flagged}, Failed: ${counts.failed}.${failedList}${flaggedList}${reportNote}`,
  );
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function enqueueContinuation(
  escape: Extract<CorrectionPassOutcome, { kind: 'escape' }>,
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
    logger.error(
      MODULE_NAME,
      `Continuation could not be enqueued; re-run the migration. Converted so far: ${escape.state.converted}. ${errorText(originalError)}`,
    );
  }
}

function setup() {
  app.storageQueue(HANDLE_START, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: START.queueName,
    handler: handleStart,
  });
}

export { handleStart };
export default {
  MODULE_NAME,
  setup,
};
