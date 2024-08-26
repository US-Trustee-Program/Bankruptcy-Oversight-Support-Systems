import { InvocationContext, HttpRequest } from '@azure/functions';
import { CamsDict, CamsHttpMethod, CamsHttpRequest } from '../lib/adapters/types/http';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import { randomUUID } from 'node:crypto';

function azureToCamsDict(it: Iterable<[string, string]>): CamsDict {
  if (!it) return {};
  return Array.from(it).reduce((acc, record) => {
    acc[record[0]] = record[1];
    return acc;
  }, {} as CamsDict);
}

export async function httpRequestToCamsHttpRequest(
  request?: HttpRequest,
): Promise<CamsHttpRequest> {
  if (!request) throw new Error('Cannot map undefined request object.');
  return {
    method: request.method as CamsHttpMethod,
    url: request.url,
    headers: azureToCamsDict(request.headers),
    query: azureToCamsDict(request.query),
    params: request.params,
    // TODO: If this is a string we can POST. If it is a stream the GETs work. <table throw>
    body: request.body ? request.json() : undefined,
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
  const requestInit = {
    method: method ?? 'GET',
    url: 'http://localhost:3000',
    body: { string: JSON.stringify(body) },
    headers: { authorization: 'Bearer ' + MockData.getJwt(), ...headers },
    ...other,
  };
  return new HttpRequest(requestInit);
}

// export function toAzureSuccess(response: object): HttpResponseInit {
//   const camsResponse = httpSuccess(response);
//   return {
//     headers: camsResponse.headers,
//     status: camsResponse.statusCode,
//     jsonBody: camsResponse.body,
//   };
// }

// export function toAzureError(
//   context: ApplicationContext,
//   moduleName: string,
//   originalError: Error,
// ): HttpResponseInit {
//   const error = isCamsError(originalError)
//     ? originalError
//     : new UnknownError(moduleName, { originalError });
//   context.logger.camsError(error);

//   const response = httpError(error);
//   return {
//     headers: response.headers,
//     status: response.statusCode,
//     jsonBody: response.body,
//   };
// }
