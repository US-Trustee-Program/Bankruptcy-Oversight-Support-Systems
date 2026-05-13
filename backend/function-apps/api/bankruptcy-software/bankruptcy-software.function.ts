import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { BankruptcySoftwareController } from '../../../lib/controllers/bankruptcy-software/bankruptcy-software.controller';
import { CamsHttpResponseInit } from '../../../lib/adapters/utils/http-response';

const MODULE_NAME = 'BANKRUPTCY-SOFTWARE-FUNCTION';

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
    const controller = new BankruptcySoftwareController(context);
    const response = await controller.handleRequest(context);
    return toAzureSuccess(response as CamsHttpResponseInit);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('bankruptcy-software', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler,
  route: 'bankruptcy-software',
});
