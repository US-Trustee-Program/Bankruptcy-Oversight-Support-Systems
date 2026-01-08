import { vi } from 'vitest';
import { InvocationContext } from '@azure/functions';
import handler from './trustee-assignments.function';
import ContextCreator from '../../azure/application-context-creator';
import { TrusteeAssignmentsController } from '../../../lib/controllers/trustee-assignments/trustee-assignments.controller';
import MockData from '@common/cams/test-utilities/mock-data';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';

describe('TrusteeAssignments Function', () => {
  let context: InvocationContext;

  beforeEach(() => {
    vi.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(
      MockData.getTrusteeAdminSession(),
    );
    context = new InvocationContext({
      logHandler: () => {},
      invocationId: 'id',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should handle successful GET request for trustee assignments', async () => {
    const req = createMockAzureFunctionRequest({
      method: 'GET',
      params: { trusteeId: 'trustee-456' },
    });

    const mockAssignments = [];
    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess({
      statusCode: 200,
      body: {
        data: mockAssignments,
        meta: { self: req.url },
      },
    });

    const mockController = {
      handleRequest: vi.fn().mockResolvedValue(camsHttpResponse),
    };

    vi.spyOn(TrusteeAssignmentsController.prototype, 'handleRequest').mockImplementation(
      mockController.handleRequest,
    );

    const result = await handler(req, context);

    expect(mockController.handleRequest).toHaveBeenCalled();
    expect(result).toEqual(azureHttpResponse);
  });

  test('should handle errors and return Azure error response', async () => {
    const req = createMockAzureFunctionRequest({
      method: 'GET',
      params: { trusteeId: 'trustee-456' },
    });

    const error = new Error('Test error');
    const { azureHttpResponse } = buildTestResponseError(error);

    vi.spyOn(TrusteeAssignmentsController.prototype, 'handleRequest').mockRejectedValue(error);

    const result = await handler(req, context);

    expect(result.status).toBe(azureHttpResponse.status);
  });
});
