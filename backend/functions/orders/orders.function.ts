import * as dotenv from 'dotenv';
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

import ContextCreator from '../azure/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import { OrdersController } from '../lib/controllers/orders/orders.controller';
import { BadRequestError } from '../lib/common-errors/bad-request';
import { Order, TransferOrderAction } from '../../../common/src/cams/orders';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { toAzureError, toAzureSuccess } from '../azure/functions';
import { CamsHttpResponse } from '../lib/adapters/utils/http-response';

const MODULE_NAME = 'ORDERS_FUNCTION';

dotenv.config();

initializeApplicationInsights();

export default async function handler(
  request: HttpRequest,
  functionContext: InvocationContext,
): Promise<HttpResponseInit> {
  const context = await ContextCreator.applicationContextCreator(functionContext, request);
  let response: HttpResponseInit;
  try {
    context.session = await ContextCreator.getApplicationContextSession(context);

    if (context.request.method === 'GET') {
      const orderGet = await getOrders(context);
      response = toAzureSuccess(orderGet);
    } else if (context.request.method === 'PATCH') {
      //TODO: Json Mapping with these requestBody objects
      await updateOrder(context, context.request.body);
      response = toAzureSuccess();
    }
    return response;
  } catch (camsError) {
    return toAzureError(context, MODULE_NAME, camsError);
  }
}

async function getOrders(context: ApplicationContext): Promise<CamsHttpResponse<Order[]>> {
  const ordersController = new OrdersController(context);
  const responseBody = await ordersController.getOrders(context);
  return responseBody;
}

async function updateOrder(context: ApplicationContext, requestBody): Promise<void> {
  const ordersController = new OrdersController(context);
  const id = context.request.params['id'];
  const orderId = requestBody['id'];
  const orderType = requestBody['orderType'];
  if (id !== orderId) {
    const camsError = new BadRequestError(MODULE_NAME, {
      message: 'Cannot update order. ID of order does not match ID of request.',
    });
    throw camsError;
  }
  if (orderType === 'transfer') {
    await ordersController.updateOrder(context, id, requestBody as TransferOrderAction);
  }
}

app.http('orders', {
  methods: ['GET', 'PATCH'],
  authLevel: 'anonymous',
  handler,
  route: 'orders/{id?}',
});
