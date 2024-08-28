import { HttpRequest, HttpResponseInit } from '@azure/functions';
import { CamsDict, CamsHttpMethod, CamsHttpRequest } from '../lib/adapters/types/http';
import { commonHeaders, httpSuccess } from '../lib/adapters/utils/http-response';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { getCamsError } from '../lib/common-errors/error-utilities';

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

export function toAzureSuccess(response: object = undefined): HttpResponseInit {
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
  const error = getCamsError(originalError, moduleName);
  context.logger.camsError(error);

  return {
    headers: commonHeaders,
    status: error.status,
    jsonBody: error.message,
  };
}
