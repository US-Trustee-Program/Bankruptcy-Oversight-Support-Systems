import { vi } from 'vitest';
import handler from './trustee-upcoming-report-dates.function';
import { TrusteeUpcomingReportDatesController } from '../../../lib/controllers/trustee-upcoming-report-dates/trustee-upcoming-report-dates.controller';
import ContextCreator from '../../azure/application-context-creator';
import { InvocationContext } from '@azure/functions';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { UnknownError } from '../../../lib/common-errors/unknown-error';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';

describe('TrusteeUpcomingReportDates Function Tests', () => {
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
    vi.spyOn(TrusteeUpcomingReportDatesController.prototype, 'handleRequest').mockResolvedValue(
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
    vi.spyOn(TrusteeUpcomingReportDatesController.prototype, 'handleRequest').mockRejectedValue(
      error,
    );

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('should handle UnknownError from controller', async () => {
    const camsContext = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'applicationContextCreator').mockResolvedValue(camsContext);
    const error = new UnknownError('MOCK_MODULE');
    const { azureHttpResponse } = buildTestResponseError(error);
    vi.spyOn(TrusteeUpcomingReportDatesController.prototype, 'handleRequest').mockRejectedValue(
      error,
    );

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });
});
