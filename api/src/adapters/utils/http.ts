import log from "../logging.service";
import { HttpResponse } from "../types/http";

const NAMESPACE = 'HTTP-UTILITY-ADAPTER';

const commonHeaders = {
  'Content-Type': 'application/json',
  'Last-Modified': Date.toString(),
};

export function httpSuccess(body: any): HttpResponse {
  return {
    headers: commonHeaders,
    statusCode: 200,
    body,
  };
}

export function httpError(error: any, code: number): HttpResponse {
  log('error', NAMESPACE, error.message, error);
  return {
    headers: commonHeaders,
    statusCode: code,
    body: {
      error: error.message,
    },
  };
}

