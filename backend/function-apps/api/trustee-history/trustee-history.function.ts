import * as dotenv from 'dotenv';
import { app, InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { TrusteeHistoryController } from '../../../lib/controllers/trustee-history/trustee-history.controller';

const MODULE_NAME = 'TRUSTEE-HISTORY-FUNCTION';

dotenv.config();

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

    const controller = new TrusteeHistoryController(context);
    const responseBody = await controller.handleRequest(context);
    return toAzureSuccess(responseBody);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('trustee-history', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'trustees/{trusteeId?}/history',
});
