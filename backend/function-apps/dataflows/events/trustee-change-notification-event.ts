import { app, InvocationContext } from '@azure/functions';
import ModuleNames from '../module-names';
import {
  TRUSTEE_CHANGE_NOTIFICATION_DLQ,
  TRUSTEE_CHANGE_NOTIFICATION_QUEUE,
} from '../../../lib/storage-queues';
import { buildFunctionName } from '../dataflows-common';
import { TrusteeChangeNotificationEvent } from '@common/cams/dataflow-events';
import ContextCreator from '../../azure/application-context-creator';
import { TrusteeChangeNotificationUseCase } from '../../../lib/use-cases/notifications/trustee-change-notification';

const MODULE_NAME = ModuleNames.TRUSTEE_CHANGE_NOTIFICATION_EVENT;
const HANDLER = buildFunctionName(MODULE_NAME, 'handler');

function serializeError(error: unknown): { name?: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

async function handler(
  event: TrusteeChangeNotificationEvent,
  invocationContext: InvocationContext,
) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(context.invocationId);
  try {
    const summary = await new TrusteeChangeNotificationUseCase(context).notify(
      context,
      event.changeSet,
    );
    context.observability.completeTrace(
      trace,
      'Trustee Change Notification',
      {
        success: summary.failed === 0,
        properties: {
          attempted: String(summary.attempted),
          failed: String(summary.failed),
        },
        measurements: {},
      },
      undefined,
      context.logger,
    );
    if (summary.failed > 0) {
      invocationContext.extraOutputs.set(TRUSTEE_CHANGE_NOTIFICATION_DLQ, {
        event,
        error: {
          message: `Trustee change notification partially failed: ${summary.failed} of ${summary.attempted} recipient(s).`,
          failures: summary.failures,
        },
      });
    }
  } catch (error) {
    // No handleRateLimitRetry here, unlike sibling consumers (e.g. trustee-verification-remap.ts):
    // this processes one notification per invocation rather than a page of Mongo writes, so a
    // transient Cosmos throttle routes straight to the DLQ instead of requeuing with backoff.
    context.observability.completeTrace(
      trace,
      'Trustee Change Notification',
      {
        success: false,
        properties: {},
        measurements: {},
      },
      undefined,
      context.logger,
    );
    invocationContext.extraOutputs.set(TRUSTEE_CHANGE_NOTIFICATION_DLQ, {
      event,
      error: serializeError(error),
    });
  }
}

function setup() {
  app.storageQueue(HANDLER, {
    connection: TRUSTEE_CHANGE_NOTIFICATION_QUEUE.connection,
    queueName: TRUSTEE_CHANGE_NOTIFICATION_QUEUE.queueName,
    handler,
    extraOutputs: [TRUSTEE_CHANGE_NOTIFICATION_DLQ],
  });
}

export { handler };

const TrusteeChangeNotificationEventDataflow = { MODULE_NAME, setup };
export default TrusteeChangeNotificationEventDataflow;
