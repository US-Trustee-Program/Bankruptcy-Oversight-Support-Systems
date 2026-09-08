import { app, InvocationContext, Timer, output } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';

import { buildFunctionName, buildQueueName, StartMessage } from '../dataflows-common';
import SyncAcmsProfessionalIds from '../../../lib/use-cases/dataflows/sync-acms-professional-ids';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import factory from '../../../lib/factory';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
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
  // Groups still to be synced after this one, processed one at a time via
  // self-requeue — see handlePage's continuation logic below.
  remainingGroups: string[];
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

    // Only the first group is queued here — handlePage requeues itself for each
    // subsequent group in `remainingGroups` once the current one is exhausted, so
    // exactly one group's ACMS queries are ever in flight for this dataflow (see
    // handlePage's continuation logic). This avoids fanning out one PageMessage
    // per group, which let every group's queries hit ACMS concurrently and
    // overwhelmed it (ACMS_TIMEOUT DLQ entries in staging).
    const [firstGroup, ...remainingGroups] = groupDesignators;

    if (firstGroup) {
      const state = await SyncAcmsProfessionalIds.resolveSyncState(
        deps,
        firstGroup,
        startMessage.purge,
      );
      const pageMessage: PageMessage = {
        groupDesignator: firstGroup,
        lastUstProfCode: state.lastUstProfCodeByGroup[firstGroup] ?? 0,
        remainingGroups,
      };
      invocationContext.extraOutputs.set(PAGE, pageMessage);
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

  const { groupDesignator, remainingGroups } = message;
  const appContext = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = appContext.observability.startTrace(invocationContext.invocationId);
  const deps = SyncAcmsProfessionalIds.createDeps(appContext);

  try {
    let lastUstProfCode = message.lastUstProfCode;
    let processedCount = 0;
    const outcomeCounts: Record<string, number> = {};

    // Only one page is fetched per invocation — the continuation below requeues
    // for the next page (same group) or the next group in remainingGroups, so
    // exactly one PageMessage for this dataflow is ever in flight, and ACMS is
    // never queried by more than one invocation at a time.
    const page = await deps.acmsGateway.getTrusteeProfessionalRecordsPage(
      appContext,
      groupDesignator,
      lastUstProfCode,
      PAGE_SIZE,
    );
    for (const record of page) {
      const outcome = await SyncAcmsProfessionalIds.processOneRecord(deps, record);
      outcomeCounts[outcome.kind] = (outcomeCounts[outcome.kind] ?? 0) + 1;
      processedCount++;
      lastUstProfCode = record.ustProfCode;
    }

    await SyncAcmsProfessionalIds.storeRuntimeState(deps, {
      id: message.groupDesignator,
      documentType: 'ACMS_PROFESSIONAL_ID_SYNC_STATE',
      lastUstProfCodeByGroup: { [groupDesignator]: lastUstProfCode },
    });

    const groupExhausted = page.length < PAGE_SIZE;

    if (!groupExhausted) {
      const nextPageMessage: PageMessage = {
        groupDesignator,
        lastUstProfCode,
        remainingGroups,
      };
      invocationContext.extraOutputs.set(PAGE, nextPageMessage);
    } else {
      const [nextGroup, ...restGroups] = remainingGroups;
      if (nextGroup) {
        const state = await SyncAcmsProfessionalIds.resolveSyncState(deps, nextGroup);
        const nextGroupMessage: PageMessage = {
          groupDesignator: nextGroup,
          lastUstProfCode: state.lastUstProfCodeByGroup[nextGroup] ?? 0,
          remainingGroups: restGroups,
        };
        invocationContext.extraOutputs.set(PAGE, nextGroupMessage);
      }
    }

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
    extraOutputs: [DLQ, PAGE],
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

export { handleStart, handlePage, timerTrigger, PAGE_SIZE };
export default {
  MODULE_NAME,
  setup,
};
