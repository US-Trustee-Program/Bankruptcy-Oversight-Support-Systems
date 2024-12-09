import * as dotenv from 'dotenv';
import { initializeApplicationInsights } from '../../azure/app-insights';
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { OrdersController } from '../../../lib/controllers/orders/orders.controller';
import { toAzureError, toAzureSuccess } from '../../azure/functions';

dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'CONSOLIDATIONS-FUNCTION';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);

  try {
    const applicationContext = await ContextCreator.applicationContextCreator(
      invocationContext,
      logger,
      request,
    );
    const controller = new OrdersController(applicationContext);
    const response = await controller.handleRequest(applicationContext);
    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('consolidations', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  handler,
  route: 'consolidations/{procedure}',
});
