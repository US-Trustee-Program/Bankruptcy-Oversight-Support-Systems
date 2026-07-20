import { app, InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { TrusteeCasesController } from '../../../lib/controllers/trustee-cases/trustee-cases.controller';
import { TrusteeCaseDivisionsController } from '../../../lib/controllers/trustee-cases/trustee-case-divisions.controller';

const MODULE_NAME = 'TRUSTEE-CASES-FUNCTION';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);

  try {
    const context = await ContextCreator.applicationContextCreator({
      invocationContext,
      request,
      logger,
    });

    const controller = new TrusteeCasesController(context);

    const controllerResponse = await controller.handleRequest(context);
    return toAzureSuccess(controllerResponse);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('trustee-cases', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'trustees/{trusteeId}/cases',
});

export async function divisionsHandler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);

  try {
    const context = await ContextCreator.applicationContextCreator({
      invocationContext,
      request,
      logger,
    });

    const controller = new TrusteeCaseDivisionsController(context);

    const controllerResponse = await controller.handleRequest(context);
    return toAzureSuccess(controllerResponse);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('trustee-case-divisions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: divisionsHandler,
  route: 'trustees/{trusteeId}/divisions',
});
