import * as dotenv from 'dotenv';
import { app, InvocationContext, Timer } from '@azure/functions';
import { initializeApplicationInsights } from '../../../azure/app-insights';
import ContextCreator from '../../../azure/application-context-creator';
import { OfficesController } from '../../../../lib/controllers/offices/offices.controller';
import { toAzureError } from '../../../azure/functions';

dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'OFFICE-STAFF-SYNC-FUNCTION';

export default async function timerTrigger(
  _myTimer: Timer,
  invocationContext: InvocationContext,
): Promise<void> {
  const logger = ContextCreator.getLogger(invocationContext);
  try {
    const appContext = await ContextCreator.getApplicationContext({ invocationContext, logger });
    const controller = new OfficesController();
    await controller.handleTimer(appContext);
  } catch (error) {
    toAzureError(logger, MODULE_NAME, error);
  }
}

app.timer('office-staff-sync', {
  schedule: '0 0 5 * * *',
  handler: timerTrigger,
});
