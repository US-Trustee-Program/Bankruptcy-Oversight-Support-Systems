import * as dotenv from 'dotenv';
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { TrusteeMatchVerificationController } from '../../../lib/controllers/trustee-match-verification/trustee-match-verification.controller';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE } from '../../../lib/storage-queues';

const MODULE_NAME = 'TRUSTEE-MATCH-VERIFICATION-FUNCTION';

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

    const controller = new TrusteeMatchVerificationController();
    const response = await controller.handleRequest(context);
    return toAzureSuccess(response);
  } catch (camsError) {
    return toAzureError(logger, MODULE_NAME, camsError);
  }
}

// Conditionally add the queue output binding - disabled in E2E tests where the queue
// extension may not be available (same pattern as case.assignment.function.ts).
app.http('trustee-match-verification', {
  methods: ['GET', 'PATCH'],
  authLevel: 'anonymous',
  handler,
  route: 'trustee-match-verification/{id?}',
  ...(process.env.AzureWebJobsDataflowsStorage
    ? { extraOutputs: [TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE] }
    : {}),
});
