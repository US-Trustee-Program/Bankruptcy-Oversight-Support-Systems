import * as dotenv from 'dotenv';
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import { OrdersController } from '../lib/controllers/orders/orders.controller';
import { Order, TransferOrderAction } from '../../../common/src/cams/orders';
import { toAzureError, toAzureSuccess } from '../azure/functions';

const MODULE_NAME = 'ORDERS_FUNCTION';

dotenv.config();

initializeApplicationInsights();

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);
  let response: HttpResponseInit;
  try {
    const context = await ContextCreator.applicationContextCreator(invocationContext, request);
    context.session = await ContextCreator.getApplicationContextSession(context);
    const orderController = new OrdersController(context);
    if (context.request.method === 'GET') {
      const orderGet = await orderController.getOrders(context);
      response = toAzureSuccess<Order[]>(orderGet);
    } else if (context.request.method === 'PATCH') {
      //TODO: Json Mapping with these requestBody objects
      const id = context.request.params['id'];
      const camsResponse = await orderController.updateOrder(
        context,
        id,
        context.request.body as TransferOrderAction,
      );
      response = toAzureSuccess(camsResponse);
    }
    return response;
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
