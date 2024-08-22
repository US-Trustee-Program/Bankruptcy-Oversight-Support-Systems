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
  const { headers: _headers, method, body, ...other } = request;
  const requestInit = {
    method: (method as CamsHttpMethod) ?? 'GET',
    url: 'http://localhost:3000',
    body: { string: JSON.stringify(body) },
    ...other,
  };
  const requestInst = new HttpRequest(requestInit);
  requestInst.headers.set('authorization', 'Bearer ' + MockData.getJwt());
  // TODO: I don't think headers is an iterable object so this probably won't work
  // headers.forEach((header) => {
  //   const parts = header.split(':');
  //   requestInst.headers.set(parts[0], parts[1]);
  // });

  return requestInst;
  // return {
  //   method: 'GET',
  //   url: 'http://localhost:3000',
  //   headers: {
  //     authorization: 'Bearer ' + MockData.getJwt(),
  //     ...headers,
  //   },
  //   query: {},
  //   params: {},
  //   user: null,
  //   get: jest.fn(),
  //   parseFormBody: jest.fn(),
  //   ...other,
  // };
}
