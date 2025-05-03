import { HttpRequest, InvocationContext } from '@azure/functions';
import { randomUUID } from 'node:crypto';

import { ResponseBody } from '../../../common/src/api/response';
import MockData from '../../../common/src/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../lib/adapters/types/basic';
import { CamsHttpRequest } from '../../lib/adapters/types/http';
import { httpSuccess } from '../../lib/adapters/utils/http-response';
import { toAzureError, toAzureSuccess } from './functions';

export function buildTestResponseError(error: Error) {
  const loggerCamsErrorSpy = jest.fn();
  const context = {
    logger: {
      camsError: loggerCamsErrorSpy,
    },
  } as unknown as ApplicationContext;

  const azureHttpResponse = toAzureError(context, 'TEST', error);

  return { azureHttpResponse, loggerCamsErrorSpy };
}

export function buildTestResponseSuccess<T extends object = undefined>(
  body: ResponseBody<T> = undefined,
  options: { headers?: Record<string, string>; statusCode?: number } = {},
) {
  const camsHttpResponse = httpSuccess<T>({ body, ...options });
  const azureHttpResponse = toAzureSuccess(camsHttpResponse);
  return { azureHttpResponse, camsHttpResponse };
}

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
  const { body, headers, method, ...other } = request;
  const requestBody = body ? JSON.stringify(body) : undefined;

  const requestInit = {
    body: { string: requestBody },
    headers: { Authorization: 'Bearer ' + MockData.getJwt(), ...headers },
    method: method ?? 'GET',
    url: 'http://localhost:3000',
    ...other,
  };
  return new HttpRequest(requestInit);
}
