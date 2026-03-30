import { vi } from 'vitest';
import handler from './trustee-upcoming-key-dates.function';
import { TrusteeUpcomingKeyDatesController } from '../../../lib/controllers/trustee-upcoming-key-dates/trustee-upcoming-key-dates.controller';
import ContextCreator from '../../azure/application-context-creator';
import { InvocationContext } from '@azure/functions';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { UnknownError } from '../../../lib/common-errors/unknown-error';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';

describe('TrusteeUpcomingKeyDates Function Tests', () => {
  const context = new InvocationContext({
    logHandler: () => {},
    invocationId: 'id',
  });
  const request = createMockAzureFunctionRequest();

  test('should handle successful response', async () => {
    const camsContext = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'applicationContextCreator').mockResolvedValue(camsContext);
    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess({
      meta: { self: request.url },
      data: null,
    });
    vi.spyOn(TrusteeUpcomingKeyDatesController.prototype, 'handleRequest').mockResolvedValue(
      camsHttpResponse,
    );

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('should handle error', async () => {
    const camsContext = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'applicationContextCreator').mockResolvedValue(camsContext);
    const error = new Error('Some unknown error');
    const { azureHttpResponse } = buildTestResponseError(error);
    vi.spyOn(TrusteeUpcomingKeyDatesController.prototype, 'handleRequest').mockRejectedValue(error);

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('should handle UnknownError from controller', async () => {
    const camsContext = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'applicationContextCreator').mockResolvedValue(camsContext);
    const error = new UnknownError('MOCK_MODULE');
    const { azureHttpResponse } = buildTestResponseError(error);
    vi.spyOn(TrusteeUpcomingKeyDatesController.prototype, 'handleRequest').mockRejectedValue(error);

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });
});
