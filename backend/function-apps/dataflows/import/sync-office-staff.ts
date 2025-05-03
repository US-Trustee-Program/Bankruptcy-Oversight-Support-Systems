import { app, InvocationContext, Timer } from '@azure/functions';

import { OfficesController } from '../../../lib/controllers/offices/offices.controller';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError } from '../../azure/functions';
import { buildFunctionName } from '../dataflows-common';

const MODULE_NAME = 'SYNC-OFFICE-STAFF';

function setup() {
  app.timer(buildFunctionName(MODULE_NAME, 'timerTrigger'), {
    handler: timerTrigger,
    schedule: '0 0 5 * * *',
  });
}

async function timerTrigger(_ignore: Timer, invocationContext: InvocationContext): Promise<void> {
  const context = await ContextCreator.getApplicationContext({
    invocationContext,
  });
  try {
    const controller = new OfficesController();
    await controller.handleTimer(context);
  } catch (error) {
    toAzureError(context.logger, MODULE_NAME, error);
  }
}

export default {
  MODULE_NAME,
  setup,
};
