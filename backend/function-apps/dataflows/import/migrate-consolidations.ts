import { app, InvocationContext, output } from '@azure/functions';
import { CaseSyncEvent } from '../../../../common/src/queue/dataflow-types';

import ApplicationContextCreator from '../../azure/application-context-creator';
import { buildFunctionName, buildQueueName, STORAGE_QUEUE_CONNECTION } from '../dataflows-common';
import ExportAndLoadCase from '../../../lib/use-cases/dataflows/export-and-load-case';
import { isNotFoundError } from '../../../lib/common-errors/not-found-error';
import { UnknownError } from '../../../lib/common-errors/unknown-error';
import {
  AcmsBounds,
  AcmsEtlQueueItem,
  AcmsPredicate,
} from '../../../lib/use-cases/dataflows/migrate-consolidations';
import AcmsOrdersController from '../../../lib/controllers/acms-orders/acms-orders.controller';
import { getCamsError } from '../../../lib/common-errors/error-utilities';

const MODULE_NAME = 'MIGRATE-CONSOLIDATIONS';
const PAGE_SIZE = 10;

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

const RETRY = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'retry'),
  connection: 'AzureWebJobsStorage',
});

const HARD_STOP = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'hard-stop'),
  connection: 'AzureWebJobsStorage',
});

// Registered function names
const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');
const HANDLE_ERROR = buildFunctionName(MODULE_NAME, 'handleError');
const HANDLE_RETRY = buildFunctionName(MODULE_NAME, 'handleRetry');
// const HTTP_TRIGGER = buildFunctionName(MODULE_NAME, 'httpTrigger');

/**
 * handleStart
 *
 * @param {object} message
 * @param {InvocationContext} context
 */
async function handleStart(bounds: AcmsBounds, invocationContext: InvocationContext) {
  for (const chapter of bounds.chapters) {
    for (const divisionCode of bounds.divisionCodes) {
      await queuePages(
        {
          divisionCode,
          chapter,
        },
        invocationContext,
      );
    }
  }
}

/**
 * handlePage
 *
 * @param page
 * @param invocationContext
 */
async function handlePage(page: AcmsEtlQueueItem[], invocationContext: InvocationContext) {
  for (const event of page) {
    await migrateConsolidation(event, invocationContext);
  }
}

async function handleError(event: CaseSyncEvent, invocationContext: InvocationContext) {
  const logger = ApplicationContextCreator.getLogger(invocationContext);
  if (isNotFoundError(event.error)) {
    logger.info(MODULE_NAME, `Abandoning attempt to sync ${event.caseId}: ${event.error.message}.`);
    return;
  }
  logger.info(
    MODULE_NAME,
    `Error encountered attempting to sync ${event.caseId}: ${event.error['message']}.`,
  );
  delete event.error;
  invocationContext.extraOutputs.set(RETRY, [event]);
}

async function handleRetry(event: CaseSyncEvent, invocationContext: InvocationContext) {
  const logger = ApplicationContextCreator.getLogger(invocationContext);

  const RETRY_LIMIT = 3;
  if (!event.retryCount) {
    event.retryCount = 1;
  } else {
    event.retryCount += 1;
  }

  if (event.retryCount > RETRY_LIMIT) {
    invocationContext.extraOutputs.set(HARD_STOP, [event]);
    logger.info(MODULE_NAME, `Too many attempts to sync ${event.caseId}.`);
  } else {
    const appContext = await ApplicationContextCreator.getApplicationContext({ invocationContext });

    if (!event.bCase) {
      const exportResult = await ExportAndLoadCase.exportCase(appContext, event);

      if (exportResult.bCase) {
        event.bCase = exportResult.bCase;
      } else {
        event.error =
          exportResult.error ??
          new UnknownError(MODULE_NAME, { message: 'Expected case detail was not returned.' });
        invocationContext.extraOutputs.set(DLQ, [event]);
        return;
      }
    }

    const loadResult = await ExportAndLoadCase.loadCase(appContext, event);

    if (loadResult.error) {
      event.error = loadResult.error;
      invocationContext.extraOutputs.set(DLQ, [event]);
    }

    logger.info(MODULE_NAME, `Successfully retried to sync ${event.caseId}.`);
  }
}

/**
 * queuePages
 *
 * @param params
 * @param invocationContext
 * @returns
 */
async function queuePages(predicate: AcmsPredicate, invocationContext: InvocationContext) {
  const logger = ApplicationContextCreator.getLogger(invocationContext);
  const appContext = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger,
  });
  const controller = new AcmsOrdersController();

  try {
    const leadCaseIds = await controller.getLeadCaseIds(appContext, predicate);

    if (!leadCaseIds.length) {
      logger.debug(
        MODULE_NAME,
        `No lead case Ids to queue for consolidation migration for division ${predicate.divisionCode} chapter ${predicate.chapter}`,
      );
      return;
    }

    logger.debug(MODULE_NAME, `Putting ${leadCaseIds.length} consolidations in the queue.`);

    // Transform the lead case IDs into the queue items.
    const queueItems = [];
    for (let i = 0; i < leadCaseIds.length; i++) {
      const leadCaseIdString = leadCaseIds[i].toString();
      const queueItem: AcmsEtlQueueItem = {
        divisionCode: predicate.divisionCode,
        chapter: predicate.chapter,
        leadCaseId: leadCaseIdString,
      };
      queueItems.push(queueItem);
    }

    // Slice the queue items into pages for the PAGE queue.
    const pages = [];
    for (let i = 0; i < queueItems.length; i += PAGE_SIZE) {
      pages.push(queueItems.slice(i, i + PAGE_SIZE - 1));
    }
    invocationContext.extraOutputs.set(PAGE, pages);
  } catch (originalError) {
    const error = getCamsError(originalError, MODULE_NAME, 'Failed to get lead case ids.');
    logger.camsError(error);
  }
}

async function migrateConsolidation(item: AcmsEtlQueueItem, context: InvocationContext) {
  const logger = ApplicationContextCreator.getLogger(context);
  const appContext = await ApplicationContextCreator.getApplicationContext({
    invocationContext: context,
    logger,
  });
  try {
    const controller = new AcmsOrdersController();

    const result = await controller.migrateConsolidation(appContext, item.leadCaseId);
    logger.debug(MODULE_NAME, `Migrate consolidation of ${item.leadCaseId}: ${result.success}.`);

    if (!result.success && result.error) {
      throw result.error;
    }
  } catch (originalError) {
    const errorMessage = {
      message: item,
      error: getCamsError(originalError, MODULE_NAME),
    };
    logger.error(MODULE_NAME, JSON.stringify(item), errorMessage.error);
    context.extraOutputs.set(HARD_STOP, [errorMessage]);
  }
}

export function setupMigrateConsolidations() {
  app.storageQueue(HANDLE_START, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: START.queueName,
    handler: handleStart,
    extraOutputs: [PAGE],
  });

  app.storageQueue(HANDLE_PAGE, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: PAGE.queueName,
    handler: handlePage,
    extraOutputs: [DLQ, HARD_STOP],
  });

  app.storageQueue(HANDLE_ERROR, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: DLQ.queueName,
    handler: handleError,
    extraOutputs: [RETRY],
  });

  app.storageQueue(HANDLE_RETRY, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: RETRY.queueName,
    handler: handleRetry,
    extraOutputs: [DLQ, HARD_STOP],
  });

  // We have stopped using HTTP triggers, preferring to just push a message on the START queue manually.
  // app.http(HTTP_TRIGGER, {
  //   route: 'migrate-consolidations',
  //   methods: ['POST'],
  //   extraOutputs: [START],
  //   handler: buildStartQueueHttpTrigger(MODULE_NAME, START),
  // });
}
