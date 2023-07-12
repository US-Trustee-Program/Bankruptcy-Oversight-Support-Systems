import log from '../services/logger.service';
import { ApplicationContext } from '../types/basic';
import { Context } from '@azure/functions';
import { ApiResponse, HttpResponse } from '../types/http';

const NAMESPACE = 'HTTP-UTILITY-ADAPTER';

const commonHeaders = {
  'Content-Type': 'application/json',
  'Last-Modified': Date.toString(),
};

export function httpSuccess(context: Context, body: any = {}): ApiResponse {
  log.info(context as ApplicationContext, NAMESPACE, 'HTTP Success');
  return {
    headers: commonHeaders,
    statusCode: 200,
    body,
  };
}

export function httpError(context: Context, error: any, code: number): ApiResponse {
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
  body: {};
  headers?: {};
  credentials?: string;
}): Promise<HttpResponse> {
  try {
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
  } catch (reason) {
    throw reason;
  }
}
/**/

export async function httpGet(data: {
  url: string;
  headers?: {};
  credentials?: string;
}): Promise<HttpResponse> {
  try {
    const response = await fetch(data.url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...data.headers,
      },
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
  } catch (reason) {
    throw reason;
  }
}
/**/
