import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import * as dotenv from 'dotenv';

import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import {
  OrdersController,
  GetOrdersResponse,
  PatchOrderResponse,
} from '../lib/controllers/orders/orders.controller';

dotenv.config();

initializeApplicationInsights();

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  ordersRequest: HttpRequest,
): Promise<void> {
  const context = await applicationContextCreator(functionContext);
  let response;
  try {
    if (ordersRequest.method === 'GET') {
      response = await getOrders(functionContext);
    } else if (ordersRequest.method === 'PATCH') {
      response = await updateOrder(functionContext, ordersRequest);
    }
    functionContext.res = httpSuccess(response);
  } catch (camsError) {
    context.logger.camsError(camsError);
    functionContext.res = httpError(camsError);
  }
};

async function getOrders(functionContext: Context): Promise<GetOrdersResponse> {
  const context = await applicationContextCreator(functionContext);
  const ordersController = new OrdersController(context);
  const responseBody = await ordersController.getOrders(context);
  return responseBody;
}

async function updateOrder(
  functionContext: Context,
  ordersRequest: HttpRequest,
): Promise<PatchOrderResponse> {
  const context = await applicationContextCreator(functionContext);
  const ordersController = new OrdersController(context);
  const id = ordersRequest.params['id'];
  return ordersController.suggestCases(context, id);
}

export default httpTrigger;
