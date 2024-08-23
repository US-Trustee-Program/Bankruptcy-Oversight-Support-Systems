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

export async function handler(
  request: HttpRequest,
  functionContext: InvocationContext,
): Promise<HttpResponseInit> {
  const context = await ContextCreator.applicationContextCreator(functionContext, request);
  let response: HttpResponseInit;
  try {
    context.session = await ContextCreator.getApplicationContextSession(context);

    if (request.method === 'GET') {
      const orderGet = await getOrders(context);
      response = httpSuccess(orderGet);
    } else if (request.method === 'PATCH') {
      const orderPatch = await updateOrder(context);
      response = httpSuccess(orderPatch);
    }
    return response;
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
  const id = context.request.params.id;
  if (id !== data['id']) {
    const camsError = new BadRequestError(MODULE_NAME, {
      message: 'Cannot update order. ID of order does not match ID of request.',
    });
    throw camsError;
  }
  const orderType = data['orderType'];
  if (orderType === 'transfer') {
    const orderUpdate = ordersController.updateOrder(context, id, data as TransferOrderAction);
    return orderUpdate;
  }
}

app.http('handler', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler,
  route: 'case-assignments/{id?}',
});

export default handler;
