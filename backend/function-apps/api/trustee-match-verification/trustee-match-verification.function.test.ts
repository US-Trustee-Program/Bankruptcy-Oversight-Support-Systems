import { vi } from 'vitest';
import handler from './trustee-match-verification.function';
import { TrusteeMatchVerificationController } from '../../../lib/controllers/trustee-match-verification/trustee-match-verification.controller';
import ContextCreator from '../../azure/application-context-creator';
import { InvocationContext } from '@azure/functions';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';

describe('Trustee Match Verification Function Tests', () => {
  let context: InvocationContext;

  beforeEach(async () => {
    const appContext = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'applicationContextCreator').mockResolvedValue(appContext);
    context = new InvocationContext({
      logHandler: () => {},
      invocationId: 'id',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should handle successful response', async () => {
    const req = createMockAzureFunctionRequest();
    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess({
      meta: { self: req.url },
      data: undefined,
    });
    vi.spyOn(TrusteeMatchVerificationController.prototype, 'handleRequest').mockResolvedValue(
      camsHttpResponse,
    );

    const response = await handler(req, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('should handle error', async () => {
    const req = createMockAzureFunctionRequest();
    const error = new Error('Some unknown error');
    const { azureHttpResponse } = buildTestResponseError(error);
    vi.spyOn(TrusteeMatchVerificationController.prototype, 'handleRequest').mockRejectedValue(
      error,
    );

    const response = await handler(req, context);
    expect(response).toEqual(azureHttpResponse);
  });
});
