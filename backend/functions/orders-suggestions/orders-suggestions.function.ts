import { InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import { app } from '@azure/functions';
import * as dotenv from 'dotenv';

import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import { OrdersController } from '../lib/controllers/orders/orders.controller';

dotenv.config();

initializeApplicationInsights();

export async function suggestedCases(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const context = await ContextCreator.applicationContextCreator(invocationContext, request);
  try {
    const ordersController = new OrdersController(context);
    const caseId = request.params['caseId'];
    const response = await ordersController.getSuggestedCases(context, caseId);
    //const success: HttpResponseInit = httpSuccess(response);
    return {
      ...httpSuccess(response),
    };
  } catch (camsError) {
    context.logger.camsError(camsError);
    invocationContext.error(
      'Problem within order-suggestions functions',
      camsError,
      request.headers.get('x-ms-original-url'),
    );
    //const errorRes = httpError(camsError);
    return {
      ...httpError(camsError),
    };
  }
}

app.http('suggestedCases', {
  methods: ['GET'],
  handler: suggestedCases,
});
