import { HttpRequest, InvocationContext } from '@azure/functions';
import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import { CamsHttpRequest } from '../../lib/adapters/types/http';
import MockData from '../../../common/src/cams/test-utilities/mock-data';
import { httpSuccess } from '../../lib/adapters/utils/http-response';
import { toAzureError, toAzureSuccess } from './functions';
import { ApplicationContext } from '../../lib/adapters/types/basic';
import { ResponseBody } from '../../../common/src/api/response';

export function createMockAzureFunctionContext(
  env: Record<string, string> = {},
): InvocationContext {
  process.env = {
    DATABASE_MOCK: 'true',
    MOCK_AUTH: 'true',
    ...env,
  };

  return new InvocationContext({ invocationId: randomUUID() });
}

export function createMockAzureFunctionRequest(
  request: Partial<CamsHttpRequest> = {},
): HttpRequest {
  const { headers, method, body, ...other } = request;
  const requestBody = body ? JSON.stringify(body) : undefined;

  const requestInit = {
    method: method ?? 'GET',
    url: 'http://localhost:3000',
    body: { string: requestBody },
    headers: { Authorization: 'Bearer ' + MockData.getJwt(), ...headers },
    ...other,
  };
  return new HttpRequest(requestInit);
}

export function buildTestResponseSuccess<T extends object = undefined>(
  body: ResponseBody<T> = undefined,
  options: { headers?: Record<string, string>; statusCode?: number } = {},
) {
  const camsHttpResponse = httpSuccess<T>({ body, ...options });
  const azureHttpResponse = toAzureSuccess(camsHttpResponse);
  return { camsHttpResponse, azureHttpResponse };
}

export function buildTestResponseError(error: Error) {
  const loggerCamsErrorSpy = vi.fn();
  const context = {
    logger: {
      camsError: loggerCamsErrorSpy,
    },
  } as unknown as ApplicationContext;

  const azureHttpResponse = toAzureError(context, 'TEST', error);

  return { azureHttpResponse, loggerCamsErrorSpy };
}
