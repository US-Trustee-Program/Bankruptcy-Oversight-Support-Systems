import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import { buildFunctionName, buildQueueName, StartMessage } from '../dataflows-common';
import RotateDivisionCodePhase1UseCase, {
  StartRotationOptions,
} from '../../../lib/use-cases/dataflows/rotate-division-code-phase-1';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.ROTATE_DIVISION_CODE_PHASE_1;
const PAGE_SIZE = 100;

// Queues
const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const PAGE = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'page'),
  connection: STORAGE_QUEUE_CONNECTION,
});

// Page-level failures only. There is no per-document retry payload: a page that fails leaves the
// state cursor where it was, and migrated documents drop out of the page query, so re-sending a
// page message resumes without reprocessing or skipping anything.
const DLQ = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'dlq'),
  connection: STORAGE_QUEUE_CONNECTION,
});

// Registered function names
const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');

/**
 * The page message carries no cursor. Both the cursor and the collection being walked live in the
 * state document, which every page re-reads — one source of truth, and a duplicate queue delivery
 * is harmless because already-migrated documents no longer match the page query.
 */
type PageMessage = Record<string, never>;

/**
 * handleStart
 *
 * CAMS-936 Phase 1: moves the per-court-unique division code off `ustDivisionCode` and onto
 * `tempCourtDivisionCode` across the `cases` and `trustee-match-verification` collections, so
 * Phase 2 can reuse the vacated name for the legacy ACMS value.
 *
 * Start message: `{ "dryRun": false }`.
 * - dryRun (default true): report what would change without writing.
 *
 * A completed real run will not restart. Delete the
 * `DIVISION_CODE_ROTATION_PHASE_1_STATE` document in `runtime-state` to force one.
 */
async function handleStart(
  message: StartMessage & StartRotationOptions,
  invocationContext: InvocationContext,
) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const result = await RotateDivisionCodePhase1UseCase.startRotation(context, {
    dryRun: message?.dryRun,
  });

  if (result.status === 'error') {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(result.error, MODULE_NAME, HANDLE_START),
    );
    return;
  }

  if (result.status === 'completed') {
    logger.info(
      MODULE_NAME,
      `Rotation already completed (${result.state.status}): renamed ${result.state.renamedCount}, ` +
        `unset ${result.state.unsetCount}. Delete the ${result.state.documentType} document to run again.`,
    );
    return;
  }

  logger.info(
    MODULE_NAME,
    `Starting division-code rotation Phase 1 (${result.dryRun ? 'DRY RUN' : 'real run'}).`,
  );
  invocationContext.extraOutputs.set(PAGE, {} as PageMessage);
}

/**
 * handlePage
 *
 * Processes one page of the collection the state document currently points at, then re-enqueues
 * itself while any work remains.
 */
async function handlePage(_ignore: PageMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const result = await RotateDivisionCodePhase1UseCase.processRotationPage(context, PAGE_SIZE);

  if (result.status === 'error') {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(result.error, MODULE_NAME, HANDLE_PAGE),
    );
    return;
  }

  if (result.hasMore) {
    invocationContext.extraOutputs.set(PAGE, {} as PageMessage);
    return;
  }

  logger.info(MODULE_NAME, 'Division-code rotation Phase 1 complete.');
}

function setup() {
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
    extraOutputs: [PAGE, DLQ],
  });
}

export default {
  MODULE_NAME,
  setup,
};
