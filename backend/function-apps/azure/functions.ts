import { HttpRequest, HttpResponseInit } from '@azure/functions';

import { LoggerImpl } from '../../lib/adapters/services/logger.service';
import { ApplicationContext } from '../../lib/adapters/types/basic';
import { CamsDict, CamsHttpMethod, CamsHttpRequest } from '../../lib/adapters/types/http';
import { CamsHttpResponseInit, commonHeaders } from '../../lib/adapters/utils/http-response';
import { getCamsError } from '../../lib/common-errors/error-utilities';

const MODULE_NAME = 'FUNCTIONS-MODULE';

export async function azureToCamsHttpRequest<B = unknown>(
  request: HttpRequest,
): Promise<CamsHttpRequest<B>> {
  try {
    return {
      body: request.body ? ((await request.json()) as unknown as B) : undefined,
      headers: azureToCamsDict(request.headers),
      method: request.method as CamsHttpMethod,
      params: request.params,
      query: azureToCamsDict(request.query),
      url: request.url,
    };
  } catch (originalError) {
    throw getCamsError(originalError, MODULE_NAME);
  }
}

export function toAzureError(
  maybeLogger: ApplicationContext | LoggerImpl,
  moduleName: string,
  originalError: Error,
): HttpResponseInit {
  const error = getCamsError(originalError, moduleName);
  const logger = maybeLogger instanceof LoggerImpl ? maybeLogger : maybeLogger.logger;
  logger.camsError(error);
  return {
    headers: commonHeaders,
    jsonBody: error.message,
    status: error.status,
  };
}

export function toAzureSuccess<T extends object = undefined>(
  response: CamsHttpResponseInit<T> = {},
): HttpResponseInit {
  const init: HttpResponseInit = {
    headers: response.headers,
    status: response.statusCode,
  };
  if (response.body) {
    init.jsonBody = response.body;
  }

  return init;
}

function azureToCamsDict(it: Iterable<[string, string]>): CamsDict {
  if (!it) {
    return {};
  }
  return Array.from(it).reduce((acc, record) => {
    acc[record[0]] = record[1];
    return acc;
  }, {} as CamsDict);
}
