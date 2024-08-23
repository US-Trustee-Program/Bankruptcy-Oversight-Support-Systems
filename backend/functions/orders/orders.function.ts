import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as dotenv from 'dotenv';

import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import {
  OrdersController,
  GetOrdersResponse,
  PatchOrderResponse,
} from '../lib/controllers/orders/orders.controller';
import { BadRequestError } from '../lib/common-errors/bad-request';
import { TransferOrderAction } from '../../../common/src/cams/orders';
import { ApplicationContext } from '../lib/adapters/types/basic';

const MODULE_NAME = 'ORDERS_FUNCTION';

dotenv.config();

initializeApplicationInsights();

async function handler(
  functionContext: InvocationContext,
  request: HttpRequest,
): Promise<HttpResponseInit> {
  const context = await ContextCreator.applicationContextCreator(functionContext, request);
  let response;
  try {
    context.session = await ContextCreator.getApplicationContextSession(context);

    if (request.method === 'GET') {
      response = await getOrders(context);
    } else if (request.method === 'PATCH') {
      response = await updateOrder(context);
    }
    return httpSuccess(response);
  } catch (camsError) {
    context.logger.camsError(camsError);
    return httpError(camsError);
  }
}

async function getOrders(context: ApplicationContext): Promise<GetOrdersResponse> {
  const ordersController = new OrdersController(context);
  const responseBody = await ordersController.getOrders(context);
  return responseBody;
}

async function updateOrder(context: ApplicationContext): Promise<PatchOrderResponse> {
  const ordersController = new OrdersController(context);
  const data = context.request.body;
  const id = context.request.params['id'];
  if (id !== data.id) {
    const camsError = new BadRequestError(MODULE_NAME, {
      message: 'Cannot update order. ID of order does not match ID of request.',
    });
    throw camsError;
  }
  const orderType = data['orderType'];
  if (orderType === 'transfer') {
    return ordersController.updateOrder(context, id, data as TransferOrderAction);
  }
}
app.http('handler', {
  methods: ['GET', 'PATCH'],
  authLevel: 'anonymous',
  handler,
  route: 'orders/{id?}',
});
export default handler;
