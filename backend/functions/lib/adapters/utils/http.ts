import log from '../services/logger.service';
import { ApplicationContext } from '../types/basic';
import { Context } from '@azure/functions';
import { ApiResponse, HttpResponse } from '../types/http';

const NAMESPACE = 'HTTP-UTILITY-ADAPTER';

const commonHeaders = {
  'Content-Type': 'application/json',
  'Last-Modified': Date.toString(),
};

export function httpSuccess(context: Context, body: object = {}): ApiResponse {
  log.info(context as ApplicationContext, NAMESPACE, 'HTTP Success');
  return {
    headers: commonHeaders,
    statusCode: 200,
    body,
  };
}

export function httpError(context: Context, error: Error, code: number): ApiResponse {
  log.error(context as ApplicationContext, NAMESPACE, error.message, error);
  return {
    headers: commonHeaders,
    statusCode: code,
    body: {
      error: error.message,
    },
  };
}

// fetch post
export async function httpPost(data: {
  url: string;
  body: object;
  headers?: object;
  credentials?: string;
}): Promise<HttpResponse> {
  const bodyContent = JSON.stringify(data.body);
  const response = await fetch(data.url, {
    method: 'POST',
    headers: {
      ...data.headers,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: bodyContent,
  });
  const responseJson = await response.json();

  const httpResponse: HttpResponse = {
    data: responseJson,
    status: response.status,
    ...response,
  };

  if (response.ok) {
    return Promise.resolve(httpResponse);
  } else {
    return Promise.reject(httpResponse);
  }
}
/**/

export async function httpGet(data: {
  url: string;
  headers?: object;
  credentials?: string;
}): Promise<HttpResponse> {
  const response = await fetch(data.url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...data.headers,
    },
  });
  const responseJson = await response.json();
  console.log("========",responseJson);
  const httpResponse: HttpResponse = {
    data: responseJson,
    status: response.status,
    ...response,
  };

  if (response.ok) {
    return Promise.resolve(httpResponse);
  } else {
    return Promise.reject(httpResponse);
  }
}
/**/
