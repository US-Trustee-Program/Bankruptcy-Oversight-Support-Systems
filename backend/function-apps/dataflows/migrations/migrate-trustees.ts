import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import {
  buildContainerName,
  buildFunctionName,
  buildQueueName,
  CursorMessage,
  dumpQueueToBlob,
  ensureContainersExist,
  StartMessage,
} from '../dataflows-common';
import MigrateTrusteesUseCase from '../../../lib/use-cases/dataflows/migrate-trustees';
import { AcmsTrusteeProfessionalRecord } from '../../../lib/use-cases/gateways.types';
import * as MigrationStateService from '../../../lib/use-cases/dataflows/trustee-migration-state.service';
import { buildQueueError, QueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';
import { TrusteeMigrationStartEvent } from '@common/cams/dataflow-events';
import factory from '../../../lib/factory';
import { ApplicationContext } from '../../../lib/adapters/types/basic';

const MODULE_NAME = ModuleNames.MIGRATE_TRUSTEES;
const PAGE_SIZE = 50; // Smaller page size for trustees with appointments
// Records per heal-page message. ACMS professional records are small
// (acmsProfessionalId + name + state), so 100 stays well within the 64KB
// Azure Storage Queue message limit. Mirrors WRITE_BATCH_SIZE conventions.
const HEAL_PAGE_SIZE = 100;

// Queues
const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: 'AzureWebJobsStorage',
});

const PAGE = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'page'),
  connection: 'AzureWebJobsStorage',
});

const DLQ = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'dlq'),
  connection: 'AzureWebJobsStorage',
});

const FAILED_APPOINTMENTS = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'failed-appointments'),
  connection: 'AzureWebJobsStorage',
});

// Heal-specific queues (inverse ACMS→CAMS professional-ID backfill).
const HEAL_PAGE = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'heal-page'),
  connection: 'AzureWebJobsStorage',
});

// Unmatched ACMS professional records from the paginated-heal backfill, routed
// here for later review and drained to blob via the flushQueues intent.
const HEAL_UNMATCHED_PROFESSIONAL_IDS = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'heal-unmatched-professional-ids'),
  connection: 'AzureWebJobsStorage',
});

// Registered function names
const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');
const HANDLE_HEAL_PAGE = buildFunctionName(MODULE_NAME, 'handleHealPage');
const HANDLE_ERROR = buildFunctionName(MODULE_NAME, 'handleError');

export type MigrationStartMessage = StartMessage &
  TrusteeMigrationStartEvent & {
    flushQueues?: boolean;
    heal?: boolean;
  };

/**
 * A heal-page message: one chunk of ACMS professional records to process.
 * Records are embedded directly so the handler never re-queries ACMS per page.
 */
export type HealPageMessage = {
  records: AcmsTrusteeProfessionalRecord[];
};

function requiresDeleteAll(start: MigrationStartMessage): boolean {
  return !!start.deleteAll;
}

type HandleStartTrace = ReturnType<ApplicationContext['observability']['startTrace']>;

/**
 * flushQueues intent: drain the failure/DLQ/unmatched queues to JSONL blobs
 * (bookend reporting / inspection). This is deliberately NOT a full-queue dump:
 * the START and PAGE queues are transient work queues for a healthy running
 * migration and are excluded. The heal-page continuation queue is likewise
 * excluded (paging queues are never flushed); only the heal UNMATCHED queue is
 * included alongside the DLQ, failed-appointments, and unmatched-professional-ids
 * queues.
 */
async function runFlushQueues(context: ApplicationContext, trace: HandleStartTrace): Promise<void> {
  const { logger } = context;
  logger.info(MODULE_NAME, 'flushQueues flag detected — dumping queues to blob storage.');
  const objectStorage = factory.getObjectStorageGateway(context);
  const outputContainerName = buildContainerName(MODULE_NAME, 'out');
  const connectionString = process.env.AzureWebJobsStorage;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  const queuesToFlush = [
    { queueName: DLQ.queueName, prefix: 'dlq', key: 'dlqFlushed' },
    {
      queueName: FAILED_APPOINTMENTS.queueName,
      prefix: 'failed-appointments',
      key: 'failedAppointmentsFlushed',
    },
    {
      queueName: HEAL_UNMATCHED_PROFESSIONAL_IDS.queueName,
      prefix: 'heal-unmatched-professional-ids',
      key: 'healUnmatchedProfessionalIdsFlushed',
    },
  ];

  const details: Record<string, string> = { mode: 'flushQueues' };
  let documentsWritten = 0;
  for (const { queueName, prefix, key } of queuesToFlush) {
    const flushed = await dumpQueueToBlob(
      objectStorage,
      logger,
      MODULE_NAME,
      connectionString,
      queueName,
      `flush-${prefix}-${timestamp}.jsonl`,
      outputContainerName,
    );
    details[key] = String(flushed);
    documentsWritten += flushed;
  }

  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
    documentsWritten,
    documentsFailed: 0,
    success: true,
    details,
  });
}

/**
 * heal intent (reader half): fetch the full ACMS professional-record set once,
 * chunk it in memory, and enqueue one heal-page message per chunk to the
 * heal-page queue. Each chunk's records are embedded directly in the message —
 * the page handler never re-queries ACMS. Heal progress is initialized on the
 * migration state document (flat heal* fields) BEFORE any page message fires so
 * the concurrent page handlers' atomic counters find initialized fields.
 *
 * The heavy per-record matching/creation work happens in handleHealPage, not
 * here, so this reader stays well within the Function timeout regardless of the
 * ACMS record count.
 */
async function runHeal(
  context: ApplicationContext,
  useCase: MigrateTrusteesUseCase,
  invocationContext: InvocationContext,
  trace: HandleStartTrace,
): Promise<void> {
  const { logger } = context;
  logger.info(MODULE_NAME, 'heal flag detected — reading ACMS professional records for backfill.');

  // Guard against running heal at the wrong time. Reading state here is read-only
  // (never creates one) so it does not perturb a fresh ATS migration.
  const stateResult = await MigrationStateService.readMigrationState(context);
  if (stateResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(stateResult.error, MODULE_NAME, HANDLE_START),
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: stateResult.error.message,
    });
    return;
  }
  const existingState = stateResult.data;

  // Refuse to run while the ATS migration is still populating trustees: heal would
  // match against a half-loaded trustee set and route records to NO_TRUSTEE_MATCH
  // that a post-migration run would resolve.
  if (existingState?.status === 'IN_PROGRESS') {
    logger.warn(
      MODULE_NAME,
      'heal skipped — ATS trustee migration is still IN_PROGRESS. Re-run heal after it completes.',
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { mode: 'heal-read', disposition: 'migration-in-progress' },
    });
    return;
  }

  // Skip if a prior heal already completed — re-running would reset counters and
  // re-enqueue the full ACMS set for no net change (backfill is idempotent).
  if (existingState?.healStatus === 'COMPLETED') {
    logger.info(
      MODULE_NAME,
      `heal skipped — already completed at ${existingState.healLastUpdatedAt}. ` +
        `Created ${existingState.healCreated ?? 0}, already-mapped ${existingState.healAlreadyMapped ?? 0}, ` +
        `unmatched ${existingState.healUnmatched ?? 0}.`,
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { mode: 'heal-read', disposition: 'already-completed' },
    });
    return;
  }

  const readResult = await useCase.readAllTrusteeProfessionalRecords();
  if (readResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(readResult.error, MODULE_NAME, HANDLE_START),
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: readResult.error.message,
    });
    return;
  }

  const acmsRecords = readResult.data;

  // Chunk the result set in memory; one heal-page message per chunk.
  const pages: AcmsTrusteeProfessionalRecord[][] = [];
  for (let i = 0; i < acmsRecords.length; i += HEAL_PAGE_SIZE) {
    pages.push(acmsRecords.slice(i, i + HEAL_PAGE_SIZE));
  }

  // Fence-write heal progress before enqueuing any page (concurrent handlers
  // rely on the counters being initialized).
  const initResult = await MigrationStateService.initHealState(context, {
    scanned: acmsRecords.length,
    pagesTotal: pages.length,
  });
  if (initResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(initResult.error, MODULE_NAME, HANDLE_START),
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: initResult.error.message,
    });
    return;
  }

  if (pages.length > 0) {
    const pageMessages: HealPageMessage[] = pages.map((records) => ({ records }));
    invocationContext.extraOutputs.set(HEAL_PAGE, pageMessages);
  }

  logger.info(
    MODULE_NAME,
    `Heal reader: enqueued ${pages.length} heal-page message(s) for ${acmsRecords.length} ACMS professional records.`,
  );

  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
    documentsWritten: 0,
    documentsFailed: 0,
    success: true,
    details: {
      mode: 'heal-read',
      scanned: String(acmsRecords.length),
      pagesEnqueued: String(pages.length),
    },
  });
}

/**
 * deleteAll intent: delete all existing trustees, appointments, and professional
 * ID mappings, then reset migration state for a clean re-run. Returns true if the
 * caller should abort (an error was routed to the DLQ), false to continue.
 */
async function runDeleteAll(
  context: ApplicationContext,
  useCase: MigrateTrusteesUseCase,
  invocationContext: InvocationContext,
  trace: HandleStartTrace,
): Promise<boolean> {
  const { logger } = context;
  logger.info(
    MODULE_NAME,
    'deleteAll flag detected. Deleting all existing trustees and appointments.',
  );

  const deleteResult = await useCase.deleteAllTrusteesAndAppointments();
  if (deleteResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(deleteResult.error, MODULE_NAME, HANDLE_START),
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: deleteResult.error.message,
    });
    return true;
  }

  const { deletedTrustees, deletedAppointments, deletedProfessionalIds } = deleteResult.data;
  logger.info(
    MODULE_NAME,
    `Successfully deleted ${deletedTrustees} trustees, ${deletedAppointments} appointments, and ${deletedProfessionalIds} professional ID mappings.`,
  );

  const resetResult = await MigrationStateService.resetMigrationState(context);
  if (resetResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(resetResult.error, MODULE_NAME, HANDLE_START),
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: resetResult.error.message,
    });
    return true;
  }

  return false;
}

/**
 * handleStart
 *
 * Initialize the trustee migration by reading existing state for resumability.
 * If already completed, skip. Otherwise, queue first/next CursorMessage with lastTrusteeId from state.
 * If deleteAll flag is present, delete all existing trustees and appointments before starting.
 * If flushQueues flag is present, dump all queues to blob storage and return.
 * If heal flag is present, backfill professional-ID mappings from ACMS and return.
 */
export async function handleStart(
  start: MigrationStartMessage,
  invocationContext: InvocationContext,
) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    const useCase = new MigrateTrusteesUseCase(context);

    if (start.flushQueues) {
      await runFlushQueues(context, trace);
      return;
    }

    if (start.heal) {
      await runHeal(context, useCase, invocationContext, trace);
      return;
    }

    if (requiresDeleteAll(start)) {
      const aborted = await runDeleteAll(context, useCase, invocationContext, trace);
      if (aborted) {
        return;
      }
    }

    const stateResult = await MigrationStateService.getOrCreateMigrationState(
      context,
      !!(start.reset || start.deleteAll),
    );

    if (stateResult.error) {
      invocationContext.extraOutputs.set(
        DLQ,
        buildQueueError(stateResult.error, MODULE_NAME, HANDLE_START),
      );
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: stateResult.error.message,
      });
      return;
    }

    const existingState = stateResult.data;

    if (existingState?.status === 'COMPLETED') {
      logger.info(
        MODULE_NAME,
        `Migration already completed at ${existingState.lastUpdatedAt}. Processed ${existingState.processedCount} trustees with ${existingState.appointmentsProcessedCount} appointments. Skipping.`,
      );
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: true,
        details: { disposition: 'already-completed' },
      });
      return;
    }

    const lastTrusteeId = existingState?.lastTrusteeId ?? null;
    const processedCount = existingState?.processedCount ?? 0;
    const appointmentsProcessedCount = existingState?.appointmentsProcessedCount ?? 0;

    if (existingState && existingState.status === 'IN_PROGRESS') {
      logger.info(
        MODULE_NAME,
        `Resuming migration from trustee ID ${lastTrusteeId}. Already processed ${processedCount} trustees with ${appointmentsProcessedCount} appointments.`,
      );
    } else {
      logger.info(MODULE_NAME, 'Starting fresh trustee migration from ATS.');
    }

    const cursorMessage: CursorMessage = {
      lastId: lastTrusteeId?.toString() ?? null,
      importAll: start.importAll ?? true,
    };
    invocationContext.extraOutputs.set(PAGE, cursorMessage);

    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { mode: existingState ? 'resume' : 'fresh-start' },
    });
  } catch (err) {
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * handlePage
 *
 * Process a page of trustees using cursor-based pagination.
 * Fetches page using cursor, processes each trustee with their appointments, updates state with new cursor position.
 * If hasMore, queues next CursorMessage. If no more results, sets status to COMPLETED.
 */
async function handlePage(cursor: CursorMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    const useCase = new MigrateTrusteesUseCase(context);

    const stateResult = await MigrationStateService.getOrCreateMigrationState(context);
    if (stateResult.error) {
      invocationContext.extraOutputs.set(
        DLQ,
        buildQueueError(stateResult.error, MODULE_NAME, HANDLE_PAGE),
      );
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: stateResult.error.message,
      });
      return;
    }

    const currentState = stateResult.data;
    const currentProcessedCount = currentState.processedCount ?? 0;
    const currentAppointmentsCount = currentState.appointmentsProcessedCount ?? 0;
    const currentAmbiguousCount = currentState.ambiguousCount ?? 0;
    const currentErrors = currentState.errors ?? 0;

    const pageResult = await useCase.getPageOfTrustees(
      cursor.lastId ? Number.parseInt(cursor.lastId) : null,
      PAGE_SIZE,
      cursor.importAll,
    );

    if (pageResult.error || !pageResult.data) {
      invocationContext.extraOutputs.set(
        DLQ,
        buildQueueError(
          pageResult.error ??
            new CamsError(MODULE_NAME, { message: 'Unexpected missing data in page result' }),
          MODULE_NAME,
          HANDLE_PAGE,
        ),
      );
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: pageResult.error?.message ?? 'Unexpected missing data in page result',
      });
      return;
    }

    const { trustees, hasMore } = pageResult.data;

    if (trustees.length === 0) {
      // No more trustees to process - mark as completed
      logger.info(MODULE_NAME, `No more trustees to migrate. Migration complete.`);
      await MigrationStateService.completeMigration(context, currentState);
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: true,
        details: { disposition: 'complete' },
      });
      return;
    }

    const lastTrusteeId = trustees.at(-1).ID;

    logger.debug(
      MODULE_NAME,
      `Processing ${trustees.length} trustees. Cursor: ${cursor.lastId ?? 'start'} -> ${lastTrusteeId}.`,
    );

    // Process page with retry logic handled in use case
    const processResult = await useCase.processPageOfTrustees(
      trustees,
      buildContainerName(MODULE_NAME, 'out'),
    );

    if (processResult.error) {
      await MigrationStateService.failMigration(context, currentState, processResult.error.message);

      invocationContext.extraOutputs.set(
        DLQ,
        buildQueueError(processResult.error, MODULE_NAME, HANDLE_PAGE),
      );
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: processResult.error.message,
      });
      return;
    }

    const { processed, appointments, errors, ambiguousCount, failedAppointments } =
      processResult.data;

    const newProcessedCount = currentProcessedCount + processed;
    const newAppointmentsCount = currentAppointmentsCount + appointments;
    const newAmbiguousCount = currentAmbiguousCount + ambiguousCount;
    const newErrors = currentErrors + errors;

    // Send failed appointments to FAILED_APPOINTMENTS queue for visibility and review
    if (failedAppointments && failedAppointments.length > 0) {
      // Collect all failed appointment messages
      const failedAppointmentMessages = failedAppointments.map((failedAppt) => ({
        type: 'FAILED_APPOINTMENT',
        classification: failedAppt.classification,
        notes: failedAppt.notes,
        mapType: failedAppt.mapType,
        timestamp: failedAppt.timestamp,
        atsAppointment: {
          TRU_ID: failedAppt.atsAppointment.TRU_ID,
          DISTRICT: failedAppt.atsAppointment.DISTRICT,
          STATE: failedAppt.atsAppointment.STATE,
          CHAPTER: failedAppt.atsAppointment.CHAPTER,
          STATUS: failedAppt.atsAppointment.STATUS,
          // Convert Date objects to ISO strings for queue serialization
          DATE_APPOINTED: failedAppt.atsAppointment.DATE_APPOINTED?.toISOString() ?? null,
          EFFECTIVE_DATE: failedAppt.atsAppointment.EFFECTIVE_DATE?.toISOString() ?? null,
        },
      }));

      // Send all messages at once (Azure Functions accepts array)
      invocationContext.extraOutputs.set(FAILED_APPOINTMENTS, failedAppointmentMessages);

      logger.info(
        MODULE_NAME,
        `Sent ${failedAppointments.length} failed appointments to failed-appointments queue for review`,
      );
    }

    const updateResult = await MigrationStateService.updateMigrationState(context, {
      ...currentState,
      lastTrusteeId,
      processedCount: newProcessedCount,
      appointmentsProcessedCount: newAppointmentsCount,
      ambiguousCount: newAmbiguousCount,
      errors: newErrors,
      status: hasMore ? 'IN_PROGRESS' : 'COMPLETED',
    });

    if (updateResult.error) {
      invocationContext.extraOutputs.set(
        DLQ,
        buildQueueError(updateResult.error, MODULE_NAME, HANDLE_PAGE),
      );
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: updateResult.error.message,
      });
      return;
    }

    if (errors > 0) {
      // Failed trustees are already logged in the use case
      logger.warn(MODULE_NAME, `${errors} trustees failed to migrate in this batch.`);
    }

    logger.debug(
      MODULE_NAME,
      `Successfully migrated ${processed} trustees with ${appointments} appointments. Total processed: ${newProcessedCount}.`,
    );

    if (hasMore) {
      const nextCursor: CursorMessage = {
        lastId: lastTrusteeId.toString() ?? null,
        ...(cursor.importAll !== undefined && { importAll: cursor.importAll }),
      };
      invocationContext.extraOutputs.set(PAGE, nextCursor);
    } else {
      logger.info(
        MODULE_NAME,
        `Trustee migration complete. Total processed: ${newProcessedCount} trustees with ${newAppointmentsCount} appointments. Ambiguous-flag trustees requiring manual review: ${newAmbiguousCount}.`,
      );
    }

    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
      documentsWritten: processed,
      documentsFailed: errors,
      success: true,
      details: {
        trustees: String(newProcessedCount),
        appointments: String(newAppointmentsCount),
        ambiguous: String(newAmbiguousCount),
      },
    });
  } catch (err) {
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * reEnqueueHealPage — re-enqueue an escape-hatch-deferred chunk of records to
 * the heal-page queue with a visibility delay so the 429 backoff has time to
 * clear. Adds jitter to avoid a thundering herd. Chunks to stay within the
 * 64KB queue-message limit. Returns true on success.
 *
 * Uses a direct queue client (not extraOutputs) because a visibility delay is
 * required, which the output binding does not support.
 */
async function reEnqueueHealPage(
  context: ApplicationContext,
  records: AcmsTrusteeProfessionalRecord[],
  recommendedVisibilitySeconds: number,
): Promise<boolean> {
  const { logger } = context;
  const connectionString = process.env.AzureWebJobsStorage;
  if (!connectionString) {
    logger.error(
      MODULE_NAME,
      `Heal escape hatch triggered but AzureWebJobsStorage is not set — ${records.length} records not re-enqueued.`,
    );
    return false;
  }

  const jitterSeconds = Math.floor(Math.random() * 30);
  const visibilityTimeoutSeconds = recommendedVisibilitySeconds + jitterSeconds;

  const chunks: AcmsTrusteeProfessionalRecord[][] = [];
  for (let i = 0; i < records.length; i += HEAL_PAGE_SIZE) {
    chunks.push(records.slice(i, i + HEAL_PAGE_SIZE));
  }

  try {
    const queueClient = StorageQueueHumbleObject.fromConnectionString(
      connectionString,
      HEAL_PAGE.queueName,
    );
    for (const chunk of chunks) {
      await queueClient.sendMessage(
        JSON.stringify({ records: chunk } as HealPageMessage),
        visibilityTimeoutSeconds,
      );
    }
    logger.warn(
      MODULE_NAME,
      `Heal escape hatch — re-enqueued ${records.length} records in ${chunks.length} message(s) with ${visibilityTimeoutSeconds}s visibility delay.`,
    );
    return true;
  } catch (sendError) {
    logger.error(
      MODULE_NAME,
      `Heal escape-hatch re-enqueue failed — ${records.length} records not re-enqueued.`,
      { error: sendError instanceof Error ? sendError.message : String(sendError) },
    );
    return false;
  }
}

/**
 * handleHealPage
 *
 * Process one chunk of ACMS professional records (writer half of the heal
 * redesign). Runs concurrently with sibling pages (queue batchSize>1), so it
 * updates heal progress via atomic counters, never read-modify-write.
 *
 * - 429 backoff + escape hatch live in the use case (backfillProfessionalIdsPage).
 *   If the escape hatch defers a tail of records, they are re-enqueued to
 *   heal-page with a visibility delay here.
 * - Unmatched records are routed to the heal-unmatched-professional-ids queue.
 * - Heal progress (created/alreadyMapped/unmatched, records remaining) is
 *   recorded atomically; the run is marked COMPLETED when the last record drains.
 */
export async function handleHealPage(
  message: HealPageMessage,
  invocationContext: InvocationContext,
) {
  const invocationStartedAt = Date.now();
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    const useCase = new MigrateTrusteesUseCase(context);
    const { records } = message;

    const pageResult = await useCase.backfillProfessionalIdsPage(records, {
      startedAt: invocationStartedAt,
    });

    if (pageResult.error) {
      invocationContext.extraOutputs.set(
        DLQ,
        buildQueueError(pageResult.error, MODULE_NAME, HANDLE_HEAL_PAGE),
      );
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleHealPage', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: pageResult.error.message,
      });
      return;
    }

    const { created, alreadyMapped, unmatched, remaining, recommendedVisibilitySeconds } =
      pageResult.data;

    const unmatchedMessages = unmatched.map((record) => ({
      type: 'UNMATCHED_PROFESSIONAL_ID',
      ...record,
    }));

    // Re-enqueue any escape-hatch-deferred records with a visibility delay. If the
    // re-enqueue fails, those records would otherwise be lost AND leave
    // healRecordsRemaining stuck above 0 forever (they never get counted). Route
    // them to the unmatched queue with a distinct reason so they stay auditable,
    // and count them below so heal completion can still converge.
    let reEnqueueFailedCount = 0;
    if (remaining.length > 0) {
      const reEnqueued = await reEnqueueHealPage(context, remaining, recommendedVisibilitySeconds);
      if (!reEnqueued) {
        reEnqueueFailedCount = remaining.length;
        for (const record of remaining) {
          unmatchedMessages.push({
            type: 'UNMATCHED_PROFESSIONAL_ID',
            acmsProfessionalId: record.acmsProfessionalId,
            firstName: record.firstName,
            lastName: record.lastName,
            state: record.state,
            reason: 'REENQUEUE_FAILED',
          });
        }
      }
    }

    // Route unmatched records (including any re-enqueue-failed drops) to the
    // dedicated heal-unmatched queue.
    if (unmatchedMessages.length > 0) {
      invocationContext.extraOutputs.set(HEAL_UNMATCHED_PROFESSIONAL_IDS, unmatchedMessages);
      logger.info(
        MODULE_NAME,
        `Heal page: routed ${unmatchedMessages.length} unmatched records to heal-unmatched-professional-ids queue.`,
      );
    }

    // Record progress atomically. Records the escape hatch successfully
    // re-enqueued are counted when their re-enqueued page runs; records that
    // FAILED to re-enqueue are counted here (as unmatched) so completion converges.
    const recordResult = await MigrationStateService.recordHealPageResult(context, {
      created,
      alreadyMapped,
      unmatched: unmatched.length + reEnqueueFailedCount,
    });
    if (recordResult.error) {
      // Progress bookkeeping failed — surface to DLQ but the writes already
      // happened (idempotent on re-run), so this is a visibility concern.
      invocationContext.extraOutputs.set(
        DLQ,
        buildQueueError(recordResult.error, MODULE_NAME, HANDLE_HEAL_PAGE),
      );
    }

    const reEnqueuedCount = remaining.length - reEnqueueFailedCount;
    logger.info(
      MODULE_NAME,
      `Heal page complete: ${created} created, ${alreadyMapped} already mapped, ${unmatched.length} unmatched, ${reEnqueuedCount} re-enqueued, ${reEnqueueFailedCount} re-enqueue-failed.`,
    );

    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleHealPage', logger, {
      documentsWritten: created,
      documentsFailed: unmatched.length + reEnqueueFailedCount,
      success: true,
      details: {
        mode: 'heal-page',
        created: String(created),
        alreadyMapped: String(alreadyMapped),
        unmatched: String(unmatched.length),
        reEnqueued: String(reEnqueuedCount),
        reEnqueueFailed: String(reEnqueueFailedCount),
      },
    });
  } catch (err) {
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleHealPage', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * handleError
 *
 * Handle infrastructure failures by logging to DLQ.
 * Individual trustee failures are now handled with retry logic in the use case.
 */
async function handleError(event: QueueError, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  // Log infrastructure failure
  const queueError = event as QueueError;
  logger.error(
    MODULE_NAME,
    `Infrastructure error in ${queueError.activityName}: ${queueError.error?.message ?? 'Unknown error'}. Logged to DLQ for manual review.`,
  );

  // Error already in DLQ (this handler processes DLQ messages)
  // Just log for visibility - no further action needed
  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleError', logger, {
    documentsWritten: 0,
    documentsFailed: 0,
    success: true,
    details: {
      activityName: queueError.activityName,
      ...(queueError.error?.message && { errorMessage: queueError.error.message }),
    },
  });
}

function setup() {
  ensureContainersExist([buildContainerName(MODULE_NAME, 'out')], MODULE_NAME);

  app.storageQueue(HANDLE_START, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: START.queueName,
    handler: handleStart,
    extraOutputs: [PAGE, DLQ, HEAL_PAGE],
  });

  app.storageQueue(HANDLE_PAGE, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: PAGE.queueName,
    handler: handlePage,
    extraOutputs: [PAGE, DLQ, FAILED_APPOINTMENTS],
  });

  app.storageQueue(HANDLE_HEAL_PAGE, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: HEAL_PAGE.queueName,
    handler: handleHealPage,
    extraOutputs: [HEAL_UNMATCHED_PROFESSIONAL_IDS, DLQ],
  });

  app.storageQueue(HANDLE_ERROR, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: DLQ.queueName,
    handler: handleError,
    extraOutputs: [],
  });
}

export default {
  MODULE_NAME,
  setup,
};
