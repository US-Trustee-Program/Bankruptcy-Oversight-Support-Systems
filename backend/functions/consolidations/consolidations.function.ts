import * as dotenv from 'dotenv';
import { initializeApplicationInsights } from '../azure/app-insights';
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import { OrdersController } from '../lib/controllers/orders/orders.controller';
import { BadRequestError } from '../lib/common-errors/bad-request';
import { toAzureError, toAzureSuccess } from '../azure/functions';

dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'CONSOLIDATIONS-FUNCTION';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const applicationContext = await ContextCreator.applicationContextCreator(
    invocationContext,
    request,
  );
  const consolidationsController = new OrdersController(applicationContext);
  const procedure = applicationContext.request.params.procedure;
  let response;

  try {
    applicationContext.session =
      await ContextCreator.getApplicationContextSession(applicationContext);

    if (procedure === 'reject') {
      response = await consolidationsController.rejectConsolidation(
        applicationContext,
        applicationContext.request.body,
      );
    } else if (procedure === 'approve') {
      response = await consolidationsController.approveConsolidation(
        applicationContext,
        applicationContext.request.body,
      );
    } else {
      throw new BadRequestError(MODULE_NAME, {
        message: `Could not perform ${procedure}.`,
      });
    }
    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(applicationContext, MODULE_NAME, error);
  }
}

app.http('consolidations', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  handler,
  route: 'consolidations/{procedure}',
});
