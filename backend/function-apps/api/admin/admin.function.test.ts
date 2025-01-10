import { InvocationContext } from '@azure/functions';
import { AdminController } from '../../../lib/controllers/admin/admin.controller';
import {
  buildTestResponseError,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import handler from './admin.function';
import { UnauthorizedError } from '../../../lib/common-errors/unauthorized-error';
import { CamsHttpMethod } from '../../../lib/adapters/types/http';

const ADMIN_KEY = 'good-key';

describe('Admin function tests', () => {
  const originalEnv = { ...process.env };
  const context = new InvocationContext();

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      ADMIN_KEY,
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('admin handler will return a 401 response code if api key is missing from body', async () => {
    const badRequest = createMockAzureFunctionRequest({
      method: 'DELETE',
      body: { apiKey: 'bad-key' }, //pragma: allowlist secret
    });
    const error = new UnauthorizedError('ADMIN-FUNCTION', {
      message: 'API key was missing or did not match.',
    });
    const { azureHttpResponse } = buildTestResponseError(error);
    const response = await handler(badRequest, context);
    expect(response).toEqual(azureHttpResponse);
  });

  const successCases = [
    ['DELETE', 204],
    ['POST', 201],
  ];
  test.each(successCases)(
    'admin handler should call controller when %s invoked',
    async (method: string, statusCode: number) => {
      const request = createMockAzureFunctionRequest({
        method: method as CamsHttpMethod,
        body: { apiKey: ADMIN_KEY },
      });

      const adminControllerSpy = jest
        .spyOn(AdminController.prototype, 'handleRequest')
        .mockResolvedValue({ statusCode });

      const result = await handler(request, context);

      expect(adminControllerSpy).toHaveBeenCalled();
      expect(result.status).toEqual(statusCode);
    },
  );
});
