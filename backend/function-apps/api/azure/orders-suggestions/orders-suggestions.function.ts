import * as dotenv from 'dotenv';
import { InvocationContext, HttpRequest, HttpResponseInit, app } from '@azure/functions';
import { OrdersController } from '../../../../lib/controllers/orders/orders.controller';
import { initializeApplicationInsights } from '../../../azure/app-insights';
import ContextCreator from '../../../azure/application-context-creator';
import { toAzureSuccess, toAzureError } from '../../../azure/functions';

dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'ORDER-SUGGESTIONS-FUNCTION';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);

  try {
    const context = await ContextCreator.applicationContextCreator({
      invocationContext,
      logger,
      request,
    });

    const controller = new OrdersController(context);

    const response = await controller.handleRequest(context);
    return toAzureSuccess(response);
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
