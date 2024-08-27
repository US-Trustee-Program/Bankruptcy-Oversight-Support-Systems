import * as dotenv from 'dotenv';
import { initializeApplicationInsights } from '../azure/app-insights';
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { OrdersController } from '../lib/controllers/orders/orders.controller';
import { BadRequestError } from '../lib/common-errors/bad-request';
import { isCamsError } from '../lib/common-errors/cams-error';
import { UnknownError } from '../lib/common-errors/unknown-error';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';

dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'CONSOLIDATIONS-FUNCTION';

export default async function handler(
  request: HttpRequest,
  functionContext: InvocationContext,
): Promise<HttpResponseInit> {
  const applicationContext = await ContextCreator.applicationContextCreator(
    functionContext,
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
    return httpSuccess(response);
  } catch (originalError) {
    const error = isCamsError(originalError)
      ? originalError
      : new UnknownError(MODULE_NAME, { originalError });
    applicationContext.logger.camsError(error);
    return httpError(error);
  }
}

app.http('consolidations', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  handler,
  route: 'consolidations/{procedure}',
});
