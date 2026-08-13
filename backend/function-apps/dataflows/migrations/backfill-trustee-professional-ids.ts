// INTENTIONAL: this migration has NO state document (no Cosmos-backed RuntimeStateRepository
// document, no cursor, no fence, no status field, no persisted counters). This is a deliberate
// design decision, not an oversight -- a state document earns its cost for recurring
// synchronization dataflows that need a tombstone/resume-pointer across an indefinite number of
// future runs. This is a true one-time migration over a small (~6,000-record) ACMS dataset that
// will never be revisited; recovery from an interrupted run is simply re-invoking handleStart
// fresh (safe, not merely tolerable -- see createProfessionalId's idempotency and the
// converged design doc's "Dataflow shape" section). Do NOT "fix" this by bolting a state
// document on.
import { app, InvocationContext, output } from '@azure/functions';
import ApplicationContextCreator from '../../azure/application-context-creator';
import {
  buildContainerName,
  buildFunctionName,
  buildQueueName,
  dumpQueueToBlob,
  ensureContainersExist,
} from '../dataflows-common';
import BackfillTrusteeProfessionalIdsUseCase, {
  readAllAcmsProfessionalRecords,
  processAcmsProfessionalRecordsPage,
} from '../../../lib/use-cases/dataflows/backfill-trustee-professional-ids';
import { AcmsTrusteeProfessionalRecord } from '../../../lib/use-cases/gateways.types';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';
import factory from '../../../lib/factory';

const MODULE_NAME = ModuleNames.BACKFILL_TRUSTEE_PROFESSIONAL_IDS;

// Records per PAGE message. Azure Storage Queue raw limit is 64KB; Azure Functions
// base64-encodes the body, so the effective payload limit before encoding is ~48KB.
// AcmsTrusteeProfessionalRecord is a small, flat record (id + name + address + phone
// strings) -- 50 records comfortably fits well under budget, consistent with this
// pattern's usual default.
const WRITE_BATCH_SIZE = 50;

const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: STORAGE_QUEUE_CONNECTION,
});
const PAGE = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'page'),
  connection: STORAGE_QUEUE_CONNECTION,
});
const DLQ = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'dlq'),
  connection: STORAGE_QUEUE_CONNECTION,
});
const FAILURES = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'failures'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');
const HANDLE_PAGE_POISON = buildFunctionName(MODULE_NAME, 'handlePagePoison');
const OUTPUT_CONTAINER = buildContainerName(MODULE_NAME, 'out');

/**
 * StartMessage -- reduced to just the pattern's standalone diagnostic flag. There is no
 * `resume`/`halt`/`lastId`-as-cursor here at all: nothing is persisted between invocations, so
 * there is nothing to resume from and nothing to fence against. `handleStart` always does the
 * full bulk read-and-dispatch pass in a single invocation (see handleStart below) -- re-running
 * it (send `{}` again) is the only "recovery" mechanism this migration has, and it is safe by
 * construction (see createProfessionalId's idempotency and the converged design doc).
 */
export type BackfillTrusteeProfessionalIdsStartMessage = {
  flushQueues?: boolean; // standalone diagnostic action; dumps queue contents to blob
};

/**
 * PAGE message carries a chunk of raw ACMS professional records plus the division-to-court
 * map needed to resolve each record's appointment-context Sets. The map is small (~271
 * entries, live CMMDO join) and fetched once in handleStart -- threading it through the PAGE
 * message avoids re-querying the live SQL CMMDO join once per page.
 */
export type BackfillTrusteeProfessionalIdsPageMessage = {
  records: AcmsTrusteeProfessionalRecord[];
  divisionToCourtMap: [string, string][];
};

/**
 * handleStart -- ONE bulk read-and-dispatch pass, no continuation chain. Reads the full ACMS
 * professional record set (~6,000 rows, mirroring the existing heal-path reader's
 * already-established "~10k rows is an acceptable single-fetch size" precedent in
 * migrate-trustees.ts), fetches the division-to-court map once, chunks the records in memory
 * into WRITE_BATCH_SIZE-sized groups, and emits one PAGE message per chunk -- all within this
 * single invocation. No lastId-based self-recursion, no multi-invocation cursor advancement.
 *
 * flushQueues is a standalone diagnostic action, not a lifecycle intent -- it dumps queue
 * contents to blob and returns without touching the normal read/dispatch path.
 *
 * A timing checkpoint wraps the full read-and-dispatch pass: the ~6,000-record/1-hour-timeout
 * scale claim in the design doc is a reasoned estimate, not yet a measurement. This log is what
 * converts it into a real number during the (separately-tracked) lower-environment validation
 * run.
 */
export async function handleStart(
  message: BackfillTrusteeProfessionalIdsStartMessage,
  invocationContext: InvocationContext,
) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  if (message.flushQueues) {
    logger.info(MODULE_NAME, 'flushQueues — draining queues to blob storage.');
    const objectStorage = factory.getObjectStorageGateway(context);
    const connectionString = process.env.AzureWebJobsDataflowsStorage;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    await dumpQueueToBlob(
      objectStorage,
      logger,
      MODULE_NAME,
      connectionString,
      START.queueName,
      `flush-start-${ts}.jsonl`,
      OUTPUT_CONTAINER,
    );
    await dumpQueueToBlob(
      objectStorage,
      logger,
      MODULE_NAME,
      connectionString,
      PAGE.queueName,
      `flush-page-${ts}.jsonl`,
      OUTPUT_CONTAINER,
    );
    await dumpQueueToBlob(
      objectStorage,
      logger,
      MODULE_NAME,
      connectionString,
      DLQ.queueName,
      `flush-dlq-${ts}.jsonl`,
      OUTPUT_CONTAINER,
    );
    await dumpQueueToBlob(
      objectStorage,
      logger,
      MODULE_NAME,
      connectionString,
      FAILURES.queueName,
      `flush-failures-${ts}.jsonl`,
      OUTPUT_CONTAINER,
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { mode: 'flushQueues' },
    });
    return;
  }

  const startedAt = Date.now();
  logger.info(MODULE_NAME, 'Starting one-time ACMS trustee-professional-id backfill.');

  const [readResult, divisionToCourtMap] = await Promise.all([
    readAllAcmsProfessionalRecords(context),
    factory.getAcmsGateway(context).getDivisionToCourtMap(context),
  ]);

  if (readResult.error || !readResult.data) {
    const camsError =
      readResult.error ??
      getCamsError(new Error('No data returned'), MODULE_NAME, 'Failed to read ACMS records');
    invocationContext.extraOutputs.set(DLQ, buildQueueError(camsError, MODULE_NAME, HANDLE_START));
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: camsError.message,
    });
    return;
  }

  const records = readResult.data;
  const divisionToCourtMapEntries: [string, string][] = Array.from(divisionToCourtMap.entries());

  const chunks: AcmsTrusteeProfessionalRecord[][] = [];
  for (let i = 0; i < records.length; i += WRITE_BATCH_SIZE) {
    chunks.push(records.slice(i, i + WRITE_BATCH_SIZE));
  }

  if (chunks.length > 0) {
    invocationContext.extraOutputs.set(
      PAGE,
      chunks.map((chunk) =>
        JSON.stringify({
          records: chunk,
          divisionToCourtMap: divisionToCourtMapEntries,
        } as BackfillTrusteeProfessionalIdsPageMessage),
      ),
    );
  }

  const elapsedMs = Date.now() - startedAt;
  logger.info(
    MODULE_NAME,
    `Backfill read-and-dispatch complete: ${records.length} ACMS records enqueued across ${chunks.length} PAGE message(s) in ${elapsedMs}ms.`,
  );

  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
    documentsWritten: 0,
    documentsFailed: 0,
    success: true,
    details: {
      recordsEnqueued: String(records.length),
      batches: String(chunks.length),
      elapsedMs: String(elapsedMs),
    },
  });
}

/**
 * handlePage -- scores and resolves one chunk of ACMS professional records against candidate
 * CAMS trustees, creating a mapping for each record that clears the auto-match threshold.
 * Delegates entirely to processAcmsProfessionalRecordsPage (candidate shortlist, appointment
 * batch-fetch, scoring, and the createProfessionalId write all happen there).
 *
 * Errors route to the FAILURES queue. This is NOT a retry queue -- per the migration pattern,
 * bulk retry for this backfill is done by re-running the whole migration fresh (safe and cheap
 * given createProfessionalId's idempotency), not by building a custom retry/backoff mechanism
 * here.
 *
 * Run visibility is log-only: matched/unmatched/alreadyMapped counts are logged per page. No
 * queryable summary document, no dashboard hook.
 */
export async function handlePage(
  message: BackfillTrusteeProfessionalIdsPageMessage,
  invocationContext: InvocationContext,
) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);
  const { records } = message;
  const divisionToCourtMap = new Map(message.divisionToCourtMap);

  try {
    const result = await processAcmsProfessionalRecordsPage(context, records, divisionToCourtMap);

    if (result.error || !result.data) {
      const camsError =
        result.error ??
        getCamsError(new Error('No data returned'), MODULE_NAME, 'Failed to process backfill page');
      throw camsError;
    }

    const { matched, unmatched, alreadyMapped } = result.data;
    logger.info(
      MODULE_NAME,
      `Backfill page complete: matched=${matched} unmatched=${unmatched} alreadyMapped=${alreadyMapped} (page size ${records.length}).`,
    );

    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
      documentsWritten: matched,
      documentsFailed: 0,
      success: true,
      details: {
        matched: String(matched),
        unmatched: String(unmatched),
        alreadyMapped: String(alreadyMapped),
      },
    });
  } catch (originalError) {
    const camsError = getCamsError(originalError, MODULE_NAME, 'Failed to process backfill page');
    logger.error(MODULE_NAME, `handlePage failed: ${camsError.message}`);
    invocationContext.extraOutputs.set(
      FAILURES,
      JSON.stringify(buildQueueError(camsError, MODULE_NAME, HANDLE_PAGE)),
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
      documentsWritten: 0,
      documentsFailed: records.length,
      success: false,
      error: camsError.message,
    });
  }
}

// Surfaces undeliverable PAGE messages in App Insights and DLQ instead of dropping them
// silently. Azure moves messages here after maxDequeueCount failed delivery attempts (default:
// 5, configured globally in host.json). The message type is Record<string, unknown> -- by the
// time a message reaches the poison queue its shape may be malformed, which is often what
// caused the failures, so it is never cast to BackfillTrusteeProfessionalIdsPageMessage.
export async function handlePagePoison(
  message: Record<string, unknown>,
  invocationContext: InvocationContext,
) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);
  logger.error(MODULE_NAME, `Poison message on page queue: ${JSON.stringify(message)}`);
  invocationContext.extraOutputs.set(
    DLQ,
    buildQueueError(
      getCamsError(new Error('poison-message'), MODULE_NAME, JSON.stringify(message)),
      MODULE_NAME,
      HANDLE_PAGE_POISON,
    ),
  );
  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePagePoison', logger, {
    documentsWritten: 0,
    documentsFailed: 1,
    success: false,
    error: 'poison-message',
  });
}

function setup() {
  ensureContainersExist([OUTPUT_CONTAINER], MODULE_NAME);

  app.storageQueue(HANDLE_START, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: START.queueName,
    handler: handleStart,
    extraOutputs: [START, PAGE, DLQ, FAILURES],
  });

  app.storageQueue(HANDLE_PAGE, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: PAGE.queueName,
    handler: handlePage,
    extraOutputs: [FAILURES],
  });

  // Poison handler — surfaces undeliverable PAGE messages in App Insights and DLQ.
  app.storageQueue(HANDLE_PAGE_POISON, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: `${PAGE.queueName}-poison`,
    handler: handlePagePoison,
    extraOutputs: [DLQ],
  });
}

export { BackfillTrusteeProfessionalIdsUseCase };
export default { MODULE_NAME, setup };
