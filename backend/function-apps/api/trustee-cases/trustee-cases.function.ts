import { app, InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { TrusteeCasesController } from '../../../lib/controllers/trustee-cases/trustee-cases.controller';

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
