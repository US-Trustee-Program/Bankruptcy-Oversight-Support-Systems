import * as dotenv from 'dotenv';
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { TrusteeCasesController } from '../../../lib/controllers/trustee-cases/trustee-cases.controller';
import { toAzureError, toAzureSuccess } from '../../azure/functions';

const MODULE_NAME = 'TRUSTEE-CASES-FUNCTION';

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

    context.session = await ContextCreator.getApplicationContextSession(context);

    const controller = new TrusteeCasesController();
    const response = await controller.handleRequest(context);
    return toAzureSuccess(response);
  } catch (camsError) {
    return toAzureError(logger, MODULE_NAME, camsError);
  }
}

app.http('trustee-cases', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'trustees/{trusteeId}/cases',
});
