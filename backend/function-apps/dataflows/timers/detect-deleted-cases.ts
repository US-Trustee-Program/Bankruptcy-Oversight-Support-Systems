import { app, InvocationContext, Timer } from '@azure/functions';
import ModuleNames from '../module-names';
import { buildFunctionName } from '../dataflows-common';
import ContextCreator from '../../azure/application-context-creator';
import DetectDeletedCases from '../../../lib/use-cases/dataflows/detect-deleted-cases';
import { CASE_DELETED_EVENT_QUEUE } from '../../../lib/storage-queues';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { toAzureError } from '../../azure/functions';

const MODULE_NAME = ModuleNames.DETECT_DELETED_CASES;
const HANDLER = buildFunctionName(MODULE_NAME, 'handler');

export async function timerTrigger(_ignore: Timer, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    const events = await DetectDeletedCases.getDeletedCaseEvents(context);

    invocationContext.extraOutputs.set(CASE_DELETED_EVENT_QUEUE, events);

    completeDataflowTrace(
      context.observability,
      trace,
      MODULE_NAME,
      'timerTrigger',
      context.logger,
      {
        documentsWritten: events.length,
        documentsFailed: 0,
        success: true,
        details: { eventCount: String(events.length) },
      },
    );
  } catch (error) {
    completeDataflowTrace(
      context.observability,
      trace,
      MODULE_NAME,
      'timerTrigger',
      context.logger,
      {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    toAzureError(context.logger, MODULE_NAME, error);
    throw error;
  }
}

function setup() {
  app.timer(HANDLER, {
    schedule: '0 0 10 * * *',
    handler: timerTrigger,
    extraOutputs: [CASE_DELETED_EVENT_QUEUE],
  });
}

export default {
  MODULE_NAME,
  setup,
};
