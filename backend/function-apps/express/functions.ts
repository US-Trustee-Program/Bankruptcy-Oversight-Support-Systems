import { Request, Response } from 'express';
import { CamsDict, CamsHttpMethod, CamsHttpRequest } from '../../lib/adapters/types/http';
import { CamsHttpResponseInit, commonHeaders } from '../../lib/adapters/utils/http-response';
import { ApplicationContext } from '../../lib/adapters/types/basic';
import { getCamsError } from '../../lib/common-errors/error-utilities';
import { LoggerImpl } from '../../lib/adapters/services/logger.service';

const MODULE_NAME = 'EXPRESS-FUNCTIONS-MODULE';

function queryToCamsDict(query: Request['query']): CamsDict {
  const result: CamsDict = {};
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      result[key] = value.join(',');
    } else if (typeof value === 'string') {
      result[key] = value;
    }
  }
  return result;
}

function headersToCamsDict(headers: Request['headers']): CamsDict {
  const result: CamsDict = {};
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      result[key] = value.join(',');
    } else if (typeof value === 'string') {
      result[key] = value;
    }
  }
  return result;
}

export function expressToCamsHttpRequest<B = unknown>(request: Request): CamsHttpRequest<B> {
  try {
    // Construct absolute URL for compatibility with controllers that expect full URLs
    const protocol = request.get('x-forwarded-proto') || request.protocol || 'http';
    const host = request.get('host') || 'localhost:7071';
    const fullUrl = `${protocol}://${host}${request.originalUrl || request.url}`;

    return {
      method: request.method as CamsHttpMethod,
      url: fullUrl,
      headers: headersToCamsDict(request.headers),
      query: queryToCamsDict(request.query),
      params: request.params,
      body: request.body as B,
    };
  } catch (originalError) {
    throw getCamsError(originalError, MODULE_NAME);
  }
}

export function toExpressSuccess<T extends object = undefined>(
  res: Response,
  response: CamsHttpResponseInit<T> = {},
): void {
  if (response.headers) {
    Object.entries(response.headers).forEach(([key, value]) => {
      res.set(key, value);
    });
  }

  const statusCode = response.statusCode || 200;

  if (response.body) {
    res.status(statusCode).json(response.body);
  } else {
    res.status(statusCode).send();
  }
}

export function toExpressError(
  res: Response,
  maybeLogger: ApplicationContext | LoggerImpl,
  moduleName: string,
  originalError: Error,
): void {
  const error = getCamsError(originalError, moduleName);
  const logger = maybeLogger instanceof LoggerImpl ? maybeLogger : maybeLogger.logger;
  logger.camsError(error);

  Object.entries(commonHeaders).forEach(([key, value]) => {
    res.set(key, value);
  });

  res.status(error.status).json(error.message);
}
