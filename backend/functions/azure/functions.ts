import { InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import { CamsDict, CamsHttpMethod, CamsHttpRequest } from '../lib/adapters/types/http';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import { randomUUID } from 'node:crypto';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { isCamsError } from '../lib/common-errors/cams-error';
import { UnknownError } from '../lib/common-errors/unknown-error';

function azureToCamsDict(it: Iterable<[string, string]>): CamsDict {
  if (!it) return {};
  return Array.from(it).reduce((acc, record) => {
    acc[record[0]] = record[1];
    return acc;
  }, {} as CamsDict);
}

export async function azureToCamsHttpRequest(request: HttpRequest): Promise<CamsHttpRequest> {
  return {
    method: request.method as CamsHttpMethod,
    url: request.url,
    headers: azureToCamsDict(request.headers),
    query: azureToCamsDict(request.query),
    params: request.params,
    body: request.body ? await request.json() : undefined,
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

  return new InvocationContext({ invocationId: randomUUID() });
}

export function createMockAzureFunctionRequest(
  request: Partial<CamsHttpRequest> = {},
): HttpRequest {
  const { headers, method, body, ...other } = request;
  const requestBody = body ? JSON.stringify(body) : '';

  const requestInit = {
    method: method ?? 'GET',
    url: 'http://localhost:3000',
    body: { string: requestBody },
    headers: { authorization: 'Bearer ' + MockData.getJwt(), ...headers },
    ...other,
  };
  return new HttpRequest(requestInit);
}

export function toAzureSuccess(response: object): HttpResponseInit {
  const camsResponse = httpSuccess(response);
  const init: HttpResponseInit = {
    headers: camsResponse.headers,
    status: camsResponse.statusCode,
  };
  if (camsResponse.body) init.jsonBody = camsResponse.body;

  return init;
}

export function toAzureError(
  context: ApplicationContext,
  moduleName: string,
  originalError: Error,
): HttpResponseInit {
  const error = isCamsError(originalError)
    ? originalError
    : new UnknownError(moduleName, { originalError });
  context.logger.camsError(error);

  const camsResponse = httpError(error);
  return {
    headers: camsResponse.headers,
    status: camsResponse.statusCode,
    jsonBody: camsResponse.body,
  };
}
