import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import * as dotenv from 'dotenv';

import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import { OrdersController } from '../lib/controllers/orders/orders.controller';
import { OrderTransfer } from '../lib/use-cases/orders/orders.model';
import { BadRequestError } from '../lib/common-errors/bad-request';

const MODULE_NAME = 'ORDERS_CONTROLLER';

dotenv.config();

initializeApplicationInsights();

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  ordersRequest: HttpRequest,
): Promise<void> {
  if (ordersRequest.method === 'GET') {
    return await getOrders(functionContext);
  } else if (ordersRequest.method === 'PATCH') {
    return await updateOrder(functionContext, ordersRequest);
  }
};

async function getOrders(functionContext: Context): Promise<void> {
  const context = await applicationContextCreator(functionContext);
  const ordersController = new OrdersController(context);
  try {
    const responseBody = await ordersController.getOrders(context);
    functionContext.res = httpSuccess(responseBody);
  } catch (camsError) {
    context.logger.camsError(camsError);
    functionContext.res = httpError(camsError);
  }
}

async function updateOrder(functionContext: Context, ordersRequest: HttpRequest): Promise<void> {
  const context = await applicationContextCreator(functionContext);
  const ordersController = new OrdersController(context);
  const data = ordersRequest?.body;
  const id = ordersRequest.params['id'];
  console.log('in the function', id, data);
  if (id !== data.id) {
    const camsError = new BadRequestError(MODULE_NAME, {
      message: 'Cannot update order. ID of order does not match ID of request.',
    });
    context.logger.camsError(camsError);
    functionContext.res = httpError(camsError);
  }
  try {
    const responseBody = await ordersController.updateOrder(context, id, data as OrderTransfer);
    functionContext.res = httpSuccess(responseBody);
  } catch (camsError) {
    context.logger.camsError(camsError);
    functionContext.res = httpError(camsError);
  }
}

export default httpTrigger;
