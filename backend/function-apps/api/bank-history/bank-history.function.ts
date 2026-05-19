import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { BankHistoryController } from '../../../lib/controllers/bank-history/bank-history.controller';

const MODULE_NAME = 'BANK-HISTORY-FUNCTION';

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
    const controller = new BankHistoryController(context);
    const response = await controller.handleRequest(context);
    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('bank-history', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'banks/{bankId}/history',
});
