import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { CamsDict, CamsHttpMethod, CamsHttpRequest } from '../../lib/adapters/types/http';
import { CamsHttpResponseInit, commonHeaders } from '../../lib/adapters/utils/http-response';
import { ApplicationContext } from '../../lib/adapters/types/basic';
import { getCamsError } from '../../lib/common-errors/error-utilities';
import { LoggerImpl } from '../../lib/adapters/services/logger.service';
import { CamsController } from '../../lib/controllers/controller';
import ContextCreator from './application-context-creator';

const MODULE_NAME = 'FUNCTIONS-MODULE';

function azureToCamsDict(it: Iterable<[string, string]>): CamsDict {
  if (!it) {
    return {};
  }
  return Array.from(it).reduce((acc, record) => {
    acc[record[0]] = record[1];
    return acc;
  }, {} as CamsDict);
}

export async function azureToCamsHttpRequest<B = unknown>(
  request: HttpRequest,
): Promise<CamsHttpRequest<B>> {
  try {
    return {
      method: request.method as CamsHttpMethod,
      url: request.url,
      headers: azureToCamsDict(request.headers),
      query: azureToCamsDict(request.query),
      params: request.params,
      body: request.body ? ((await request.json()) as unknown as B) : undefined,
    };
  } catch (originalError) {
    throw getCamsError(originalError, MODULE_NAME);
  }
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

type ControllerClass = new (context: ApplicationContext) => CamsController;

export function createControllerHandler(ControllerType: ControllerClass, moduleName: string) {
  return async (
    request: HttpRequest,
    invocationContext: InvocationContext,
  ): Promise<HttpResponseInit> => {
    const logger = ContextCreator.getLogger(invocationContext);
    try {
      const context = await ContextCreator.applicationContextCreator({
        invocationContext,
        logger,
        request,
      });
      context.session = await ContextCreator.getApplicationContextSession(context);
      const controller = new ControllerType(context);
      const response = await controller.handleRequest(context);
      return toAzureSuccess(response);
    } catch (error) {
      return toAzureError(logger, moduleName, error);
    }
  };
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
    status: error.status,
    jsonBody: { message: error.message, status: error.status },
  };
}
