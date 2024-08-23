import { InvocationContext, HttpRequest } from '@azure/functions';
import { CamsHttpMethod, CamsHttpRequest } from '../lib/adapters/types/http';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import { randomUUID } from 'node:crypto';

export function httpRequestToCamsHttpRequest(request?: HttpRequest): CamsHttpRequest {
  if (!request) throw new Error('Cannot map undefined request object.');
  return {
    method: request.method as CamsHttpMethod,
    url: request.url,
    headers: JSON.parse(JSON.stringify(request.headers)),
    query: JSON.parse(JSON.stringify(request.query)),
    params: request.params,
    body: request.body,
  };
}

export function createMockAzureFunctionContext(
  env: Record<string, string> = {},
): InvocationContext {
  process.env = {
    DATABASE_MOCK: 'true',
    MOCK_AUTH: 'true',
    ...env,
  };

  /* eslint-disable-next-line @typescript-eslint/no-require-imports */
  const context = require('azure-function-context-mock');
  context.invocationId = randomUUID();
  return context;
}

export function createMockAzureFunctionRequest(
  request: Partial<CamsHttpRequest> = {},
): HttpRequest {
  const { headers, method, body, ...other } = request;
  const requestInit = {
    method: (method as CamsHttpMethod) ?? 'GET',
    url: 'http://localhost:3000',
    body: { string: JSON.stringify(body) },
    headers: { authorization: 'Bearer ' + MockData.getJwt(), ...headers },
    ...other,
  };
  return new HttpRequest(requestInit);
}
