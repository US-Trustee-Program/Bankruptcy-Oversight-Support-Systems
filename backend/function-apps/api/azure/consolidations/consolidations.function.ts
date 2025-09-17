import { app, HttpRequest, InvocationContext, HttpResponseInit } from '@azure/functions';
import * as dotenv from 'dotenv';
import { OrdersController } from '../../../../lib/controllers/orders/orders.controller';
import { initializeApplicationInsights } from '../../../azure/app-insights';
import ContextCreator from '../../../azure/application-context-creator';
import { toAzureSuccess, toAzureError } from '../../../azure/functions';

dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'CONSOLIDATIONS-FUNCTION';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);

  try {
    const context = await ContextCreator.applicationContextCreator({
      invocationContext,
      request,
      logger,
    });

    const controller = new OrdersController(context);
    const response = await controller.handleRequest(context);
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
