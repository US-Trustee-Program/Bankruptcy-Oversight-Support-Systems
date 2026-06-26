import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { NotificationRoutingController } from '../../../lib/controllers/admin/notification-routing.controller';

const MODULE_NAME = 'NOTIFICATION-ROUTING-FUNCTION';

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
    const controller = new NotificationRoutingController(context);
    const response = await controller.handleRequest(context);
    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('notification-routing', {
  methods: ['GET', 'PUT'],
  authLevel: 'anonymous',
  handler,
  route: 'dev-tools/notification-routing/{routingId?}',
});
