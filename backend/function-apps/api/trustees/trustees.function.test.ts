import { InvocationContext } from '@azure/functions';
import handler from './trustees.function';
import ContextCreator from '../../azure/application-context-creator';
import { TrusteesController } from '../../../lib/controllers/trustees/trustees.controller';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';

describe('Trustees Function', () => {
  let context: InvocationContext;

  beforeEach(() => {
    jest
      .spyOn(ContextCreator, 'getApplicationContextSession')
      .mockResolvedValue(MockData.getTrusteeAdminSession());
    context = new InvocationContext({
      logHandler: () => {},
      invocationId: 'id',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should handle successful trustee request', async () => {
    const req = createMockAzureFunctionRequest();
    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess({
      meta: {
        self: req.url,
      },
      data: [],
    });

    jest.spyOn(TrusteesController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);

    const result = await handler(req, context);
    expect(result).toEqual(azureHttpResponse);
  });

  test('should handle errors and return azure error response', async () => {
    const req = createMockAzureFunctionRequest();
    const error = new Error('Test error');
    const { azureHttpResponse } = buildTestResponseError(error);

    jest.spyOn(TrusteesController.prototype, 'handleRequest').mockRejectedValue(error);

    const result = await handler(req, context);

    expect(result).toEqual(azureHttpResponse);
  });
});
