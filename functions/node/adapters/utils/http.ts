import log from '../services/logger.service.js';
import { LogContext } from '../types/basic.d';
import { HttpResponse } from '../types/http.js';

const NAMESPACE = 'HTTP-UTILITY-ADAPTER';

const commonHeaders = {
  'Content-Type': 'application/json',
  'Last-Modified': Date.toString(),
};

export function httpSuccess(context: LogContext, body: any = {}): HttpResponse {
  log.info(context, NAMESPACE, 'HTTP Success');
  return {
    headers: commonHeaders,
    statusCode: 200,
    body,
  };
}

export function httpError(context: LogContext, error: any, code: number): HttpResponse {
  log.error(context, NAMESPACE, error.message, error);
  return {
    headers: commonHeaders,
    statusCode: code,
    body: {
      error: error.message,
    },
  };
}
