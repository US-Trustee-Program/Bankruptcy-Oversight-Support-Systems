import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import { buildFunctionName, buildQueueName, STORAGE_QUEUE_CONNECTION } from '../dataflows-common';
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

const HARD_STOP = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'hard-stop'),
  connection: 'AzureWebJobsStorage',
});

// Registered function names
const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');

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
      pages.push(queueItems.slice(i, i + PAGE_SIZE));
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
    extraOutputs: [HARD_STOP],
  });
}
