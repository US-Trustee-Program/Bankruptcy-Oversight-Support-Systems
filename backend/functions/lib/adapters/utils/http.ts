import log from '../services/logger.service';
import { Context } from '../types/basic';
import { HttpResponse } from '../types/http';

const NAMESPACE = 'HTTP-UTILITY-ADAPTER';

const commonHeaders = {
  'Content-Type': 'application/json',
  'Last-Modified': Date.toString(),
};

export function httpSuccess(context: Context, body: any = {}): HttpResponse {
  log.info(context, NAMESPACE, 'HTTP Success');
  return {
    headers: commonHeaders,
    statusCode: 200,
    body,
  };
}

export function httpError(context: Context, error: any, code: number): HttpResponse {
  log.error(context, NAMESPACE, error.message, error);
  return {
    headers: commonHeaders,
    statusCode: code,
    body: {
      error: error.message,
    },
  };
}

export async function httpPost(data: {url: string, body: {}, headers: {}}): Promise<Response> {
  let requestInit: RequestInit = {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...data.headers,
      },
      body: `${data.body}`,
      cache: 'default'
  };

  return await fetch(data.url, requestInit);
}