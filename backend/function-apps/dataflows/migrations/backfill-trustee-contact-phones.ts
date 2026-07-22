import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import {
  buildFunctionName,
  buildQueueName,
  buildStartQueueHttpTrigger,
  StartMessage,
} from '../dataflows-common';
import BackfillTrusteeContactPhonesUseCase from '../../../lib/use-cases/dataflows/backfill-trustee-contact-phones';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.BACKFILL_TRUSTEE_CONTACT_PHONES;

const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const DLQ = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'dlq'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HTTP_TRIGGER = buildFunctionName(MODULE_NAME, 'httpTrigger');

async function handleStart(_ignore: StartMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const result = await BackfillTrusteeContactPhonesUseCase.backfillTrusteeContactPhones(context);

  if (result.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(result.error, MODULE_NAME, HANDLE_START),
    );
    return;
  }

  const {
    internalMigrated,
    internalSkipped,
    internalFailed,
    staffMigrated,
    staffSkipped,
    staffFailed,
  } = result.data!;

  if (internalFailed > 0 || staffFailed > 0) {
    invocationContext.extraOutputs.set(DLQ, {
      module: MODULE_NAME,
      message: `Backfill completed with failures. Internal: ${internalFailed} failed. Staff: ${staffFailed} failed.`,
    });
  }

  logger.info(
    MODULE_NAME,
    `Backfill complete. Internal — migrated: ${internalMigrated}, skipped: ${internalSkipped}, failed: ${internalFailed}. Staff — migrated: ${staffMigrated}, skipped: ${staffSkipped}, failed: ${staffFailed}.`,
  );
}

function setup() {
  app.storageQueue(HANDLE_START, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: START.queueName,
    handler: handleStart,
    extraOutputs: [DLQ],
  });

  app.http(HTTP_TRIGGER, {
    route: 'backfill-trustee-contact-phones',
    methods: ['POST'],
    extraOutputs: [START],
    handler: buildStartQueueHttpTrigger(MODULE_NAME, START),
  });
}

export default {
  MODULE_NAME,
  setup,
};
