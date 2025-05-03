import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as dotenv from 'dotenv';

import { OrdersController } from '../../../lib/controllers/orders/orders.controller';
import { initializeApplicationInsights } from '../../azure/app-insights';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';

dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'CONSOLIDATIONS-FUNCTION';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const context = await ContextCreator.applicationContextCreator({
    invocationContext,
    request,
  });

  try {
    const controller = new OrdersController(context);
    const response = await controller.handleRequest(context);
    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(context.logger, MODULE_NAME, error);
  }
}

app.http('consolidations', {
  authLevel: 'anonymous',
  handler,
  methods: ['PUT'],
  route: 'consolidations/{procedure}',
});
