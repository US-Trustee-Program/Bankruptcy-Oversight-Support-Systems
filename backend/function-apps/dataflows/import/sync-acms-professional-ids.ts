import { app, InvocationContext, Timer, output } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';

import { buildFunctionName, buildQueueName, StartMessage } from '../dataflows-common';
import SyncAcmsProfessionalIds from '../../../lib/use-cases/dataflows/sync-acms-professional-ids';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import factory from '../../../lib/factory';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import { handleRateLimitRetry } from '../dataflows-rate-limit';

const MODULE_NAME = 'SYNC-ACMS-PROFESSIONAL-IDS';
const PAGE_SIZE = 500;

type SyncAcmsProfessionalIdsStartMessage = StartMessage & {
  // Purges all existing trustee-professional-ids mappings and resets every group's sync
  // bookmark to zero before backfilling — a full, from-scratch reload from ACMS.
  purge?: boolean;
};

type PageMessage = {
  groupDesignator: string;
  lastUstProfCode: number;
  retryCount?: number;
  firstAttemptAt?: string;
};

// Queues
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

// Registered function names
const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');
const TIMER_TRIGGER = buildFunctionName(MODULE_NAME, 'timerTrigger');

async function handleStart(
  startMessage: SyncAcmsProfessionalIdsStartMessage,
  invocationContext: InvocationContext,
) {
  const logger = ContextCreator.getLogger(invocationContext);
  const observability = factory.getObservability(logger);
  const trace = observability.startTrace(invocationContext.invocationId);
  try {
    const connectionString = process.env.AzureWebJobsDataflowsStorage;
    if (!connectionString) {
      throw new Error('Missing required environment variable: AzureWebJobsDataflowsStorage');
    }

    const context = await ContextCreator.getApplicationContext({
      invocationContext,
      observability,
    });
    const deps = SyncAcmsProfessionalIds.createDeps(context);

    if (startMessage.purge) {
      logger.info(
        MODULE_NAME,
        'purge flag detected — deleting all existing professional ID mappings.',
      );
      await SyncAcmsProfessionalIds.purgeAll(deps);
    }

    const groupDesignators = await SyncAcmsProfessionalIds.getGroupDesignators(deps);
    const queueClient = StorageQueueHumbleObject.fromConnectionString(
      connectionString,
      PAGE.queueName,
    );

    for (const groupDesignator of groupDesignators) {
      const state = await SyncAcmsProfessionalIds.resolveSyncState(
        deps,
        groupDesignator,
        startMessage.purge,
      );
      const pageMessage: PageMessage = {
        groupDesignator,
        lastUstProfCode: state.lastUstProfCodeByGroup[groupDesignator] ?? 0,
      };
      await queueClient.sendMessage(JSON.stringify(pageMessage));
    }

    completeDataflowTrace(observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { groupsQueued: String(groupDesignators.length) },
    });
  } catch (originalError) {
    completeDataflowTrace(observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: originalError instanceof Error ? originalError.message : String(originalError),
    });
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(originalError, MODULE_NAME, HANDLE_START),
    );
  }
}

async function handlePage(message: PageMessage, invocationContext: InvocationContext) {
  const connectionString = process.env.AzureWebJobsDataflowsStorage;
  if (!connectionString) {
    throw new Error('Missing required environment variable: AzureWebJobsDataflowsStorage');
  }

  const { groupDesignator } = message;
  const appContext = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = appContext.observability.startTrace(invocationContext.invocationId);
  const deps = SyncAcmsProfessionalIds.createDeps(appContext);

  try {
    let lastUstProfCode = message.lastUstProfCode;
    let processedCount = 0;
    const outcomeCounts: Record<string, number> = {};

    let page = await deps.acmsGateway.getTrusteeProfessionalRecordsPage(
      appContext,
      groupDesignator,
      lastUstProfCode,
      PAGE_SIZE,
    );
    while (page.length > 0) {
      for (const record of page) {
        const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);
        outcomeCounts[outcome.kind] = (outcomeCounts[outcome.kind] ?? 0) + 1;
        processedCount++;
        lastUstProfCode = record.ustProfCode;
      }
      page = await deps.acmsGateway.getTrusteeProfessionalRecordsPage(
        appContext,
        groupDesignator,
        lastUstProfCode,
        PAGE_SIZE,
      );
    }

    await SyncAcmsProfessionalIds.storeRuntimeState(deps, {
      id: message.groupDesignator,
      documentType: 'ACMS_PROFESSIONAL_ID_SYNC_STATE',
      lastUstProfCodeByGroup: { [groupDesignator]: lastUstProfCode },
    });

    completeDataflowTrace(
      appContext.observability,
      trace,
      MODULE_NAME,
      'handlePage',
      appContext.logger,
      {
        documentsWritten: processedCount,
        documentsFailed: 0,
        success: true,
        details: {
          groupDesignator,
          totalProcessed: String(processedCount),
          ...Object.fromEntries(Object.entries(outcomeCounts).map(([k, v]) => [k, String(v)])),
        },
      },
    );
  } catch (error) {
    // On a transient error, retry from the ORIGINAL starting bookmark (message.lastUstProfCode),
    // not any locally-advanced progress — some records processed this invocation may be
    // reprocessed, but linking/matching is idempotent (createProfessionalId's conflict
    // detection and the fingerprint/name-match bucket lookups either no-op or reconfirm the
    // same outcome), so this trades a little duplicate work for zero risk of skipping a record
    // due to an uncommitted partial bookmark advance.
    const rateLimitRetryStatus = await handleRateLimitRetry({
      error,
      message,
      checkQueueName: PAGE.queueName,
      dlqOutput: DLQ,
      context: appContext,
      moduleName: MODULE_NAME,
      activityName: 'handlePage',
      connectionString,
    });

    if (rateLimitRetryStatus === 'retried') {
      completeDataflowTrace(
        appContext.observability,
        trace,
        MODULE_NAME,
        'handlePage',
        appContext.logger,
        {
          documentsWritten: 0,
          documentsFailed: 0,
          success: false,
          error: 'rate-limited-requeued',
        },
      );
      return;
    }

    if (rateLimitRetryStatus === 'exhausted') {
      completeDataflowTrace(
        appContext.observability,
        trace,
        MODULE_NAME,
        'handlePage',
        appContext.logger,
        {
          documentsWritten: 0,
          documentsFailed: 1,
          success: false,
          error: 'rate-limit-retry-exhausted',
        },
      );
      return;
    }

    throw error;
  }
}

async function timerTrigger(_timer: Timer, invocationContext: InvocationContext): Promise<void> {
  const logger = ContextCreator.getLogger(invocationContext);
  const observability = factory.getObservability(logger);
  const trace = observability.startTrace(invocationContext.invocationId);
  try {
    invocationContext.extraOutputs.set(START, {});
    completeDataflowTrace(observability, trace, MODULE_NAME, 'timerTrigger', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
    });
  } catch (error) {
    completeDataflowTrace(observability, trace, MODULE_NAME, 'timerTrigger', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function setup() {
  app.storageQueue(HANDLE_START, {
    connection: START.connection,
    queueName: START.queueName,
    extraOutputs: [DLQ, PAGE],
    handler: handleStart,
  });

  app.storageQueue(HANDLE_PAGE, {
    connection: PAGE.connection,
    queueName: PAGE.queueName,
    extraOutputs: [DLQ],
    handler: handlePage,
  });

  app.timer(TIMER_TRIGGER, {
    // Daily, after the ACMS replica refresh completes — acms-cams-transition's daily sync runs
    // at 02:00 UTC for the same reason; this follows 30 minutes after it.
    schedule: '0 30 2 * * *',
    extraOutputs: [START],
    handler: timerTrigger,
  });
}

export { handleStart, handlePage, timerTrigger };
export default {
  MODULE_NAME,
  setup,
};
