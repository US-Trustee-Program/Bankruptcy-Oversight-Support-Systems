import { vi } from 'vitest';
import { InvocationContext } from '@azure/functions';
import handler from './trustee-staff.function';
import ContextCreator from '../../azure/application-context-creator';
import { TrusteeStaffController } from '../../../lib/controllers/trustee-staff/trustee-staff.controller';
import MockData from '@common/cams/test-utilities/mock-data';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';

describe('Trustee Staff Function', () => {
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

  test('should handle successful trustee staff request', async () => {
    const req = createMockAzureFunctionRequest();
    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess({
      meta: {
        self: req.url,
      },
      data: [],
    });

    vi.spyOn(TrusteeStaffController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);

    const result = await handler(req, context);
    expect(result).toEqual(azureHttpResponse);
  });

  test('should handle errors and return azure error response', async () => {
    const req = createMockAzureFunctionRequest();
    const error = new Error('Test error');
    const { azureHttpResponse } = buildTestResponseError(error);

    vi.spyOn(TrusteeStaffController.prototype, 'handleRequest').mockRejectedValue(error);

    const result = await handler(req, context);

    expect(result).toEqual(azureHttpResponse);
  });
});
