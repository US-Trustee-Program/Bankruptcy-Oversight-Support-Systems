import * as dotenv from 'dotenv';
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { OrdersController } from '../../../lib/controllers/orders/orders.controller';
import { toAzureError, toAzureSuccess } from '../../azure/functions';

const MODULE_NAME = 'ORDERS-FUNCTION';

dotenv.config();

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
  } catch (camsError) {
    return toAzureError(logger, MODULE_NAME, camsError);
  }
}

app.http('orders', {
  methods: ['GET', 'PATCH'],
  authLevel: 'anonymous',
  handler,
  route: 'orders/{id?}',
});
