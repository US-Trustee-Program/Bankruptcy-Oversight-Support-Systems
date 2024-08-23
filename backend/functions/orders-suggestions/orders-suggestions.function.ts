import { InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import { OrdersController } from '../lib/controllers/orders/orders.controller';
import { isCamsError } from '../lib/common-errors/cams-error';
import { UnknownError } from '../lib/common-errors/unknown-error';

import * as dotenv from 'dotenv';
dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'ORDER-SUGGESTIONS-FUNCTION' as const;

export async function handler(
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
    const response = await controller.getSuggestedCases(applicationContext, caseId);
    return httpSuccess(response);
  } catch (originalError) {
    const error = isCamsError(originalError)
      ? originalError
      : new UnknownError(MODULE_NAME, { originalError });
    applicationContext.logger.camsError(error);
    return httpError(error);
  }
}

export default handler;
