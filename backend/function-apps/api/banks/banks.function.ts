import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { BanksController } from '../../../lib/controllers/banks/banks.controller';

const MODULE_NAME = 'BANKS-FUNCTION';

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
    const controller = new BanksController(context);

    const method = request.method;
    const bankId = request.params.bankId;
    let responseBody;

    if (method === 'GET' && bankId) {
      responseBody = await controller.handleGetOne(context);
    } else if (method === 'GET') {
      responseBody = await controller.handleGet(context);
    } else if (method === 'POST') {
      responseBody = await controller.handlePost(context);
    } else if (method === 'PUT' && bankId) {
      responseBody = await controller.handlePut(context);
    } else {
      return { status: 405, jsonBody: 'Method Not Allowed' };
    }

    return toAzureSuccess(responseBody);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('banks', {
  methods: ['GET', 'POST', 'PUT'],
  authLevel: 'anonymous',
  handler,
  route: 'banks/{bankId?}',
});
