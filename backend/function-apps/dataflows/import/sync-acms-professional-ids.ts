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
// Kept small so one page finishes well inside host.json's shared 60s queue visibilityTimeout
// (the trigger can't renew the lease), preventing redelivery to a concurrent invocation.
const PAGE_SIZE = 50;

type SyncAcmsProfessionalIdsStartMessage = StartMessage & {
  // Deletes all professional-id records and the sync bookmark, then syncs every group from zero.
  purge?: boolean;
};

type PageMessage = {
  groupDesignator: string;
  lastUstProfCode: number;
  // Groups to sync after this one, chained one at a time by handlePage.
  remainingGroups: string[];
  // Forces a zero bookmark per group even if another run re-persists the bookmark document after
  // purgeAll deletes it.
  purge?: boolean;
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

    // Queues only the first group; handlePage chains through remainingGroups so only one ACMS
    // query for this dataflow is ever in flight.
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
        purge: startMessage.purge,
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

  const { groupDesignator, remainingGroups = [] } = message;
  const appContext = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = appContext.observability.startTrace(invocationContext.invocationId);
  const deps = SyncAcmsProfessionalIds.createDeps(appContext);

  try {
    let lastUstProfCode = message.lastUstProfCode;
    let processedCount = 0;
    const outcomeCounts: Record<string, number> = {};

    // One page per invocation; the continuation below requeues the next page or the next group.
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
        purge: message.purge,
      };
      invocationContext.extraOutputs.set(PAGE, nextPageMessage);
    } else {
      const [nextGroup, ...restGroups] = remainingGroups;
      if (nextGroup) {
        const state = await SyncAcmsProfessionalIds.resolveSyncState(
          deps,
          nextGroup,
          message.purge,
        );
        const nextGroupMessage: PageMessage = {
          groupDesignator: nextGroup,
          lastUstProfCode: state.lastUstProfCodeByGroup[nextGroup] ?? 0,
          remainingGroups: restGroups,
          purge: message.purge,
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
    // Retries from message.lastUstProfCode; reprocessing is safe because upsertProfessionalId
    // overwrites by key and the bookmark is stored only after the full page.
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
    // Daily, 30 minutes after acms-cams-transition's 02:00 UTC schedule.
    schedule: '0 30 2 * * *',
    extraOutputs: [START],
    handler: timerTrigger,
  });
}

export { handlePage };
export default {
  MODULE_NAME,
  setup,
};
