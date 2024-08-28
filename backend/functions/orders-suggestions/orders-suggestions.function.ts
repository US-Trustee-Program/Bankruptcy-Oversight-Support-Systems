import { InvocationContext, HttpRequest, HttpResponseInit, app } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import { OrdersController } from '../lib/controllers/orders/orders.controller';

import * as dotenv from 'dotenv';
import { toAzureError, toAzureSuccess } from '../azure/functions';
dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'ORDER-SUGGESTIONS-FUNCTION' as const;

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const applicationContext = await ContextCreator.applicationContextCreator(
    invocationContext,
    request,
  );
  const controller = new OrdersController(applicationContext);
  try {
    applicationContext.session =
      await ContextCreator.getApplicationContextSession(applicationContext);

    const caseId = request.params['caseId'];
    const body = await controller.getSuggestedCases(applicationContext, caseId);
    return toAzureSuccess(body);
  } catch (error) {
    return toAzureError(applicationContext, MODULE_NAME, error);
  }
}

app.http('orders-suggestions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'orders-suggestions/{caseId?}',
});
