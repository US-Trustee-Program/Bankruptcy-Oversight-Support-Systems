import { InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { NotificationRoutingController } from '../../../lib/controllers/admin/notification-routing.controller';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import handler from './notification-routing.function';

describe('Notification Routing Function tests', () => {
  const invocationContext = new InvocationContext();

  beforeEach(async () => {
    const appContext = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'applicationContextCreator').mockResolvedValue(appContext);
    vi.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(appContext.session);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return success response', async () => {
    const request = createMockAzureFunctionRequest({ method: 'GET' });
    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess();
    vi.spyOn(NotificationRoutingController.prototype, 'handleRequest').mockResolvedValue(
      camsHttpResponse,
    );
    const response = await handler(request, invocationContext);
    expect(response).toEqual(azureHttpResponse);
  });

  test('should return failure response', async () => {
    const request = createMockAzureFunctionRequest({ method: 'GET' });
    const error = new Error('some error');
    const { azureHttpResponse } = buildTestResponseError(error);
    vi.spyOn(NotificationRoutingController.prototype, 'handleRequest').mockRejectedValue(error);
    const response = await handler(request, invocationContext);
    expect(response).toEqual(azureHttpResponse);
  });
});
