import { app, InvocationContext, Timer, output } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';

import {
  buildFunctionName,
  buildQueueName,
  buildStartQueueHttpTrigger,
  StartMessage,
} from '../dataflows-common';
import SyncTrusteeAppointmentsUseCase from '../../../lib/use-cases/dataflows/sync-trustee-appointments';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { TrusteeAppointmentSyncEvent } from '@common/cams/dataflow-events';
import { TrusteeAppointmentsSyncState } from '../../../lib/use-cases/gateways.types';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import { AppInsightsObservability } from '../../../lib/adapters/services/observability';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { handleRateLimitRetry } from '../dataflows-rate-limit';
import { getCamsError } from '../../../lib/common-errors/error-utilities';

const MODULE_NAME = 'SYNC-TRUSTEE-APPOINTMENTS';
const PAGE_SIZE = 100;

type SyncTrusteeAppointmentsStartMessage = StartMessage & {
  lastSyncDate?: string;
  reset?: boolean;
  deleteAll?: boolean;
  overrideRuntimeState?: TrusteeAppointmentsSyncState;
  flushQueues?: boolean;
};

type PageMessage = {
  events: TrusteeAppointmentSyncEvent[];
  retryCount?: number;
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
const HANDLE_PAGE_POISON = buildFunctionName(MODULE_NAME, 'handlePagePoison');
const HTTP_TRIGGER = buildFunctionName(MODULE_NAME, 'httpTrigger');
const TIMER_TRIGGER = buildFunctionName(MODULE_NAME, 'timerTrigger');

async function handleStart(
  startMessage: SyncTrusteeAppointmentsStartMessage,
  invocationContext: InvocationContext,
) {
  const logger = ContextCreator.getLogger(invocationContext);
  const observability = new AppInsightsObservability(logger);
  const trace = observability.startTrace(invocationContext.invocationId);
  try {
    const context = await ContextCreator.getApplicationContext({
      invocationContext,
      observability,
    });
    if (startMessage.flushQueues) {
      logger.info(
        MODULE_NAME,
        'flushQueues flag detected — no queue dump implemented yet, exiting.',
      );
      completeDataflowTrace(observability, trace, MODULE_NAME, 'handleStart', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: true,
        details: { mode: 'flushQueues' },
      });
      return;
    }

    const useCase = new SyncTrusteeAppointmentsUseCase(context);

    if (startMessage.deleteAll) {
      logger.info(MODULE_NAME, 'deleteAll flag detected — deleting all case appointment records.');
      const deleteResult = await useCase.deleteAll();
      if (deleteResult.error) {
        invocationContext.extraOutputs.set(
          DLQ,
          buildQueueError(getCamsError(deleteResult.error, MODULE_NAME), MODULE_NAME, HANDLE_START),
        );
        completeDataflowTrace(observability, trace, MODULE_NAME, 'handleStart', logger, {
          documentsWritten: 0,
          documentsFailed: 0,
          success: false,
          error: deleteResult.error.message,
        });
        return;
      }
    }

    const { events, latestSyncDate } = await useCase.getAppointmentEvents(
      startMessage.lastSyncDate,
      startMessage.reset || startMessage.deleteAll,
      startMessage.overrideRuntimeState,
    );

    if (!events.length) {
      completeDataflowTrace(observability, trace, MODULE_NAME, 'handleStart', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: true,
      });
      return;
    }

    let start = 0;
    let end = 0;

    const pages: PageMessage[] = [];
    while (end < events.length) {
      start = end;
      end += PAGE_SIZE;
      pages.push({ events: events.slice(start, end) });
    }
    invocationContext.extraOutputs.set(PAGE, pages);

    if (latestSyncDate) {
      await useCase.storeRuntimeState(latestSyncDate);
    }
    completeDataflowTrace(observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { pagesQueued: String(pages.length), totalEvents: String(events.length) },
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

/**
 * handlePage
 *
 * Process a page of trustee appointment events by matching to CAMS trustees
 * and updating the SyncedCase with trusteeId.
 *
 * @param {PageMessage} message
 * @param {InvocationContext} invocationContext
 */
async function handlePage(message: PageMessage, invocationContext: InvocationContext) {
  const connectionString = process.env.AzureWebJobsDataflowsStorage;
  if (!connectionString) {
    throw new Error('Missing required environment variable: AzureWebJobsDataflowsStorage');
  }

  const { events } = message;
  const appContext = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = appContext.observability.startTrace(invocationContext.invocationId);

  try {
    const useCase = new SyncTrusteeAppointmentsUseCase(appContext);
    const { successCount, dlqMessages, scenarioDistribution } =
      await useCase.processAppointments(events);

    const totalEvents = events.length;
    const autoMatchRate =
      totalEvents > 0 ? (scenarioDistribution.autoMatchCount / totalEvents) * 100 : 0;
    const highConfidenceRate =
      totalEvents > 0 ? (scenarioDistribution.highConfidenceMatchCount / totalEvents) * 100 : 0;

    invocationContext.extraOutputs.set(DLQ, dlqMessages);
    completeDataflowTrace(
      appContext.observability,
      trace,
      MODULE_NAME,
      'handlePage',
      appContext.logger,
      {
        documentsWritten: successCount,
        documentsFailed: dlqMessages.length,
        success: true,
        details: {
          totalEvents: String(totalEvents),
          autoMatchCount: String(scenarioDistribution.autoMatchCount),
          imperfectMatchCount: String(scenarioDistribution.imperfectMatchCount),
          highConfidenceMatchCount: String(scenarioDistribution.highConfidenceMatchCount),
          noMatchCount: String(scenarioDistribution.noMatchCount),
          multipleMatchCount: String(scenarioDistribution.multipleMatchCount),
          reVerificationCount: String(scenarioDistribution.reVerificationCount),
        },
        additionalMetrics: [
          { name: 'TrusteeAutoMatchRate', value: autoMatchRate },
          { name: 'TrusteeTotalEventsProcessed', value: totalEvents },
          { name: 'TrusteeHighConfidenceMatchRate', value: highConfidenceRate },
          { name: 'TrusteeReVerificationCount', value: scenarioDistribution.reVerificationCount },
        ],
      },
    );
  } catch (error) {
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

async function handlePagePoison(
  message: Record<string, unknown>,
  invocationContext: InvocationContext,
) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  logger.error(MODULE_NAME, `Poison message on page queue: ${JSON.stringify(message)}`);
  invocationContext.extraOutputs.set(DLQ, [
    buildQueueError(
      getCamsError(new Error('poison-message'), MODULE_NAME, 'handlePagePoison'),
      MODULE_NAME,
      'handlePagePoison',
    ),
  ]);
  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePagePoison', logger, {
    documentsWritten: 0,
    documentsFailed: 1,
    success: false,
    error: 'poison-message',
  });
}

async function timerTrigger(_timer: Timer, invocationContext: InvocationContext): Promise<void> {
  const logger = ContextCreator.getLogger(invocationContext);
  const observability = new AppInsightsObservability(logger);
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

  app.storageQueue(HANDLE_PAGE_POISON, {
    connection: PAGE.connection,
    queueName: `${PAGE.queueName}-poison`,
    extraOutputs: [DLQ],
    handler: handlePagePoison,
  });

  app.timer(TIMER_TRIGGER, {
    schedule: '0 35 9 * * *', // 5 minutes after sync-cases (at 9:30)
    extraOutputs: [START],
    handler: timerTrigger,
  });

  app.http(HTTP_TRIGGER, {
    route: 'sync-trustee-appointments',
    methods: ['POST'],
    extraOutputs: [START],
    handler: buildStartQueueHttpTrigger(MODULE_NAME, START),
  });
}

export { handleStart, handlePage, handlePagePoison, timerTrigger };
export default {
  MODULE_NAME,
  setup,
};
