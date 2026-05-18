import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import { ApplicationContext } from '../../../lib/adapters/types/basic';
import {
  buildContainerName,
  buildFunctionName,
  buildQueueName,
  buildStartQueueHttpTrigger,
  CursorMessage,
  ensureContainersExist,
  StartMessage,
} from '../dataflows-common';
import * as MigrateTrusteesUseCase from '../../../lib/use-cases/dataflows/migrate-trustees';
import * as MigrationStateService from '../../../lib/use-cases/dataflows/trustee-migration-state.service';
import { buildQueueError, QueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { isTooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';
import { TrusteeMigrationStartEvent } from '@common/cams/dataflow-events';

const MODULE_NAME = ModuleNames.MIGRATE_TRUSTEES;
const PAGE_SIZE = 50; // Smaller page size for trustees with appointments

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

// Registered function names
const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');
const HANDLE_ERROR = buildFunctionName(MODULE_NAME, 'handleError');
const HTTP_TRIGGER = buildFunctionName(MODULE_NAME, 'httpTrigger');

type MigrationStartMessage = StartMessage & TrusteeMigrationStartEvent;

/**
 * performDeleteAllIfRequested
 *
 * Handle deleteAll workflow if requested in the start message.
 * Deletes all existing trustees and appointments, then resets migration state.
 *
 * @returns true if workflow succeeded or was not requested, false if errors occurred (DLQ already populated)
 */
async function performDeleteAllIfRequested(
  start: MigrationStartMessage,
  context: ApplicationContext,
  invocationContext: InvocationContext,
): Promise<boolean> {
  const { logger } = context;

  if (!start.deleteAll) {
    return true; // nothing to do, continue normal flow
  }

  logger.info(
    MODULE_NAME,
    'deleteAll flag detected. Deleting all existing trustees and appointments.',
  );

  const deleteResult = await MigrateTrusteesUseCase.deleteAllTrusteesAndAppointments(context);
  if (deleteResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(deleteResult.error, MODULE_NAME, HANDLE_START),
    );
    return false;
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
    return false;
  }

  return true;
}

/**
 * handleStart
 *
 * Initialize the trustee migration by reading existing state for resumability.
 * If already completed, skip. Otherwise, queue first/next CursorMessage with lastTrusteeId from state.
 * If deleteAll flag is present, delete all existing trustees and appointments before starting.
 */
async function handleStart(start: MigrationStartMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  try {
    const deleteOk = await performDeleteAllIfRequested(start, context, invocationContext);
    if (!deleteOk) {
      return; // DLQ already populated
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
      return;
    }

    const existingState = stateResult.data;

    if (existingState?.status === 'COMPLETED') {
      logger.info(
        MODULE_NAME,
        `Migration already completed at ${existingState.lastUpdatedAt}. Processed ${existingState.processedCount} trustees with ${existingState.appointmentsProcessedCount} appointments. Skipping.`,
      );
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

    const cursorMessage: CursorMessage = { lastId: lastTrusteeId?.toString() ?? null };
    invocationContext.extraOutputs.set(PAGE, cursorMessage);
  } catch (error) {
    if (isTooManyRequestsError(error)) {
      logger.warn(
        MODULE_NAME,
        'Rate limited (429). Message will be retried by Azure on next delivery.',
      );
      throw error;
    }
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(getCamsError(error as Error, MODULE_NAME), MODULE_NAME, HANDLE_START),
    );
    throw error;
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

  try {
    const stateResult = await MigrationStateService.getOrCreateMigrationState(context);
    if (stateResult.error) {
      invocationContext.extraOutputs.set(
        DLQ,
        buildQueueError(stateResult.error, MODULE_NAME, HANDLE_PAGE),
      );
      return;
    }

    const currentState = stateResult.data;
    const currentProcessedCount = currentState.processedCount ?? 0;
    const currentAppointmentsCount = currentState.appointmentsProcessedCount ?? 0;
    const currentErrors = currentState.errors ?? 0;

    const pageResult = await MigrateTrusteesUseCase.getPageOfTrustees(
      context,
      cursor.lastId ? Number.parseInt(cursor.lastId) : null,
      PAGE_SIZE,
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
      return;
    }

    const { trustees, hasMore } = pageResult.data;

    if (trustees.length === 0) {
      // No more trustees to process - mark as completed
      logger.info(MODULE_NAME, `No more trustees to migrate. Migration complete.`);

      await MigrationStateService.completeMigration(context, currentState);
      return;
    }

    const lastTrusteeId = trustees.at(-1).ID;

    logger.debug(
      MODULE_NAME,
      `Processing ${trustees.length} trustees. Cursor: ${cursor.lastId ?? 'start'} -> ${lastTrusteeId}.`,
    );

    // Process page with retry logic handled in use case
    const processResult = await MigrateTrusteesUseCase.processPageOfTrustees(
      context,
      trustees,
      buildContainerName(MODULE_NAME, 'out'),
    );

    if (processResult.error) {
      await MigrationStateService.failMigration(context, currentState, processResult.error.message);

      invocationContext.extraOutputs.set(
        DLQ,
        buildQueueError(processResult.error, MODULE_NAME, HANDLE_PAGE),
      );
      return;
    }

    const { processed, appointments, errors, failedAppointments } = processResult.data;

    const newProcessedCount = currentProcessedCount + processed;
    const newAppointmentsCount = currentAppointmentsCount + appointments;
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
      errors: newErrors,
      status: hasMore ? 'IN_PROGRESS' : 'COMPLETED',
    });

    if (updateResult.error) {
      invocationContext.extraOutputs.set(
        DLQ,
        buildQueueError(updateResult.error, MODULE_NAME, HANDLE_PAGE),
      );
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
      const nextCursor: CursorMessage = { lastId: lastTrusteeId.toString() ?? null };
      invocationContext.extraOutputs.set(PAGE, nextCursor);
    } else {
      logger.info(
        MODULE_NAME,
        `Trustee migration complete. Total processed: ${newProcessedCount} trustees with ${newAppointmentsCount} appointments.`,
      );
    }
  } catch (error) {
    if (isTooManyRequestsError(error)) {
      logger.warn(
        MODULE_NAME,
        'Rate limited (429). Message will be retried by Azure on next delivery.',
      );
      throw error;
    }
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(getCamsError(error as Error, MODULE_NAME), MODULE_NAME, HANDLE_PAGE),
    );
    throw error;
  }
}

/**
 * handleError
 *
 * Handle infrastructure failures by logging to DLQ.
 * Individual trustee failures are now handled with retry logic in the use case.
 */
async function handleError(event: QueueError, invocationContext: InvocationContext) {
  const logger = ApplicationContextCreator.getLogger(invocationContext);

  // Log infrastructure failure
  const queueError = event as QueueError;
  logger.error(
    MODULE_NAME,
    `Infrastructure error in ${queueError.activityName}: ${queueError.error?.message ?? 'Unknown error'}. Logged to DLQ for manual review.`,
  );

  // Error already in DLQ (this handler processes DLQ messages)
  // Just log for visibility - no further action needed
}

function setup() {
  ensureContainersExist([buildContainerName(MODULE_NAME, 'out')], MODULE_NAME);

  app.storageQueue(HANDLE_START, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: START.queueName,
    handler: handleStart,
    extraOutputs: [PAGE, DLQ],
  });

  app.storageQueue(HANDLE_PAGE, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: PAGE.queueName,
    handler: handlePage,
    extraOutputs: [PAGE, DLQ, FAILED_APPOINTMENTS],
  });

  app.storageQueue(HANDLE_ERROR, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: DLQ.queueName,
    handler: handleError,
    extraOutputs: [],
  });

  app.http(HTTP_TRIGGER, {
    route: 'migrate-trustees',
    methods: ['POST'],
    extraOutputs: [START],
    handler: buildStartQueueHttpTrigger(MODULE_NAME, START),
  });
}

export { handleStart, handlePage };

export default {
  MODULE_NAME,
  setup,
};
