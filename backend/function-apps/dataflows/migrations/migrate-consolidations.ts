import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import { buildFunctionName, buildQueueName } from '../dataflows-common';
import {
  AcmsBounds,
  AcmsEtlQueueItem,
  AcmsPredicate,
} from '../../../lib/use-cases/dataflows/migrate-consolidations';
import AcmsOrdersController from '../../../lib/controllers/acms-orders/acms-orders.controller';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import { AppInsightsObservability } from '../../../lib/adapters/services/observability';
import { completeDataflowTrace } from '../dataflow-telemetry.types';

const MODULE_NAME = 'MIGRATE-CONSOLIDATIONS';
const PAGE_SIZE = 10;

// Queues
const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const PAGE = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'page'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const HARD_STOP = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'hard-stop'),
  connection: STORAGE_QUEUE_CONNECTION,
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
  const logger = ApplicationContextCreator.getLogger(invocationContext);
  const observability = new AppInsightsObservability();
  const trace = observability.startTrace(invocationContext.invocationId);
  let totalQueued = 0;
  for (const chapter of bounds.chapters) {
    for (const divisionCode of bounds.divisionCodes) {
      logger.debug(MODULE_NAME, `Queueing division ${divisionCode} chapter ${chapter}.`);
      await queuePages(
        {
          divisionCode,
          chapter,
        },
        invocationContext,
      );
      totalQueued++;
    }
  }
  completeDataflowTrace(observability, trace, MODULE_NAME, 'handleStart', logger, {
    documentsWritten: 0,
    documentsFailed: 0,
    success: true,
    details: {
      pagesQueued: String(totalQueued),
      chapters: String(bounds.chapters.length),
      divisions: String(bounds.divisionCodes.length),
    },
  });
}

/**
 * handlePage
 *
 * @param page
 * @param invocationContext
 */
async function handlePage(page: AcmsEtlQueueItem[], invocationContext: InvocationContext) {
  const logger = ApplicationContextCreator.getLogger(invocationContext);
  const observability = new AppInsightsObservability();
  const trace = observability.startTrace(invocationContext.invocationId);
  logger.debug(MODULE_NAME, `Processing page of ${page.length} migrations.`);
  for (const event of page) {
    await migrateConsolidation(event, invocationContext);
  }
  completeDataflowTrace(observability, trace, MODULE_NAME, 'handlePage', logger, {
    documentsWritten: page.length,
    documentsFailed: 0,
    success: true,
  });
}

/**
 * queuePages
 *
 * @param params
 * @param invocationContext
 * @returns
 */
async function queuePages(predicate: AcmsPredicate, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
  });
  const controller = new AcmsOrdersController();

  try {
    const leadCaseIds = await controller.getLeadCaseIds(context, predicate);

    if (!leadCaseIds.length) {
      context.logger.debug(
        MODULE_NAME,
        `No consolidations to queue for division ${predicate.divisionCode} chapter ${predicate.chapter}`,
      );
      return;
    }

    // Transform the lead case IDs into queue items.
    const queueItems: AcmsEtlQueueItem[] = leadCaseIds.map((leadCaseId) => {
      return {
        divisionCode: predicate.divisionCode,
        chapter: predicate.chapter,
        leadCaseId: leadCaseId.toString(),
      };
    });

    // Slice the queue items into pages for the PAGE queue.
    const pages = [];
    for (let i = 0; i < queueItems.length; i += PAGE_SIZE) {
      pages.push(queueItems.slice(i, i + PAGE_SIZE));
    }

    context.logger.debug(
      MODULE_NAME,
      `Queueing ${leadCaseIds.length} consolidations over ${pages.length} pages for division ${predicate.divisionCode} chapter ${predicate.chapter}.`,
    );

    invocationContext.extraOutputs.set(PAGE, pages);
  } catch (originalError) {
    const error = getCamsError(
      originalError,
      MODULE_NAME,
      `Failed to queue consolidations for division ${predicate.divisionCode} chapter ${predicate.chapter}.`,
    );
    context.logger.camsError(error);
  }
}

async function migrateConsolidation(item: AcmsEtlQueueItem, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
  });
  const { logger } = context;
  try {
    logger.debug(
      MODULE_NAME,
      `Starting migration of case ${formatCaseIdForLog(item)} for division ${item.divisionCode}, chapter ${item.chapter}.`,
    );
    const controller = new AcmsOrdersController();
    const result = await controller.migrateConsolidation(context, item.leadCaseId);
    logger.debug(
      MODULE_NAME,
      `Migrate consolidation of case ${formatCaseIdForLog(item)} ${result.success ? 'successful' : 'failed'}.`,
      result.error ?? result,
    );

    if (!result.success && result.error) {
      throw result.error;
    }
  } catch (originalError) {
    const errorMessage = {
      message: item,
      error: getCamsError(originalError, MODULE_NAME),
    };
    logger.error(MODULE_NAME, errorMessage.error.message);
    invocationContext.extraOutputs.set(HARD_STOP, [errorMessage]);
  }
}

function formatCaseIdForLog(item: AcmsEtlQueueItem) {
  // The caseId is a numeric string. The divisionCode is not left padded with zeros.
  const caseNumber = item.leadCaseId.slice(item.leadCaseId.length - 5);
  return [item.divisionCode.padStart(3, '0'), item.chapter, caseNumber].join('-');
}

function setup() {
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

export default {
  MODULE_NAME,
  setup,
};
