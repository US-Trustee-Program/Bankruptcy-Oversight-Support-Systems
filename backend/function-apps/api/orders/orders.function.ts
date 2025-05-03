import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as dotenv from 'dotenv';

import { OrdersController } from '../../../lib/controllers/orders/orders.controller';
import { initializeApplicationInsights } from '../../azure/app-insights';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';

const MODULE_NAME = 'ORDERS-FUNCTION';

dotenv.config();

initializeApplicationInsights();

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
  } catch (camsError) {
    return toAzureError(context.logger, MODULE_NAME, camsError);
  }
}

app.http('orders', {
  authLevel: 'anonymous',
  handler,
  methods: ['GET', 'PATCH'],
  route: 'orders/{id?}',
});
