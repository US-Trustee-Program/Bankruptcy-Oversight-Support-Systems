import * as dotenv from 'dotenv';
import { initializeApplicationInsights } from '../azure/app-insights';
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import {
  ManageConsolidationResponse,
  OrdersController,
} from '../lib/controllers/orders/orders.controller';
import { BadRequestError } from '../lib/common-errors/bad-request';
import { toAzureError, toAzureSuccess } from '../azure/functions';
import { ConsolidationOrder } from '../../../common/src/cams/orders';

dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'CONSOLIDATIONS-FUNCTION' as const;

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);

  try {
    const applicationContext = await ContextCreator.applicationContextCreator(
      invocationContext,
      request,
    );
    const controller = new OrdersController(applicationContext);
    const procedure = applicationContext.request.params.procedure;
    let response: ManageConsolidationResponse;

    if (procedure === 'reject') {
      response = await controller.rejectConsolidation(applicationContext);
    } else if (procedure === 'approve') {
      response = await controller.approveConsolidation(applicationContext);
    } else {
      throw new BadRequestError(MODULE_NAME, {
        message: `Could not perform ${procedure}.`,
      });
    }
    return toAzureSuccess<ConsolidationOrder[]>(response);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('consolidations', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  handler,
  route: 'consolidations/{procedure}',
});
