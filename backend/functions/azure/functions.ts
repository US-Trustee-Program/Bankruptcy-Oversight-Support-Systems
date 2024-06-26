import { Context, HttpRequest } from '@azure/functions';
import { CamsHttpRequest } from '../lib/adapters/types/http';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import { randomUUID } from 'node:crypto';

export function httpRequestToCamsHttpRequest(request?: HttpRequest): CamsHttpRequest {
  if (!request) throw new Error('Cannot map undefined request object.');
  return {
    method: request.method,
    url: request.url,
    headers: request.headers,
    query: request.query,
    params: request.params,
    body: request.body,
  };
}

export function createMockAzureFunctionContext(env: Record<string, string> = {}): Context {
  process.env = {
    DATABASE_MOCK: 'true',
    MOCK_AUTH: 'true',
    ...env,
  };

  const context = require('azure-function-context-mock');
  context.invocationId = randomUUID();
  return context;
}

export function createMockAzureFunctionRequest(request: Partial<HttpRequest> = {}): HttpRequest {
  const { headers, ...other } = request;
  return {
    method: 'GET',
    url: 'http://localhost:3000',
    headers: {
      authorization: 'Bearer ' + MockData.getJwt(),
      ...headers,
    },
    query: {},
    params: {},
    user: null,
    get: jest.fn(),
    parseFormBody: jest.fn(),
    ...other,
  };
}
