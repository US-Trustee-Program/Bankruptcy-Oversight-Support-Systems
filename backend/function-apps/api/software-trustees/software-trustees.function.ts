import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { SoftwareTrusteesController } from '../../../lib/controllers/software-trustees/software-trustees.controller';

const MODULE_NAME = 'SOFTWARE-TRUSTEES-FUNCTION';

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

    context.session = await ContextCreator.getApplicationContextSession(context);
    const controller = new SoftwareTrusteesController(context);
    const response = await controller.handleRequest(context);
    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('software-trustees', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'bankruptcy-software/{softwareId}/trustees',
});
