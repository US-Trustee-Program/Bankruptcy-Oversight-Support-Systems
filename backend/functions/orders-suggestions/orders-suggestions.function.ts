import { InvocationContext, HttpRequest, HttpResponseInit, app } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import { OrdersController } from '../lib/controllers/orders/orders.controller';

import * as dotenv from 'dotenv';
import { toAzureError, toAzureSuccess } from '../azure/functions';
dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'ORDER-SUGGESTIONS-FUNCTION';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);
  try {
    const applicationContext = await ContextCreator.applicationContextCreator(
      invocationContext,
      logger,
      request,
    );
    const controller = new OrdersController(applicationContext);

    const body = await controller.getSuggestedCases(applicationContext);
    return toAzureSuccess(body);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('orders-suggestions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'orders-suggestions/{caseId?}',
});
