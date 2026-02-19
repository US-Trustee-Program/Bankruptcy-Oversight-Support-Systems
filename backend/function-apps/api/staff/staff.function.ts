import * as dotenv from 'dotenv';
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { StaffController } from '../../../lib/controllers/staff/staff.controller';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import ContextCreator from '../../azure/application-context-creator';

dotenv.config();

const MODULE_NAME = 'STAFF-FUNCTION';

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

    const controller = new StaffController(context);
    const response = await controller.handleRequest(context);
    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('staff', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'staff',
});
