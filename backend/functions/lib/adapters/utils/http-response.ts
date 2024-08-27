import { HttpResponseInit } from '@azure/functions';
import { CamsError } from '../../common-errors/cams-error';

const commonHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'Last-Modified': Date.now().toString(),
};

export type CamsErrorBody = {
  success: false;
  message: string;
};

export type CamsHttpResponse<T extends object = undefined> = {
  headers?: Record<string, string>;
  statusCode?: number;
  body?: T;
};

// export function httpSuccess<T extends object = undefined>(
//   response: CamsHttpResponse<T> = { statusCode: 204 },
// ): CamsHttpResponse<T> {
//   return {
//     headers: { ...commonHeaders, ...response.headers },
//     statusCode: response.statusCode ?? 200,
//     body: response.body,
//   };
// }

export function httpSuccess<T extends object = undefined>(body?: T): HttpResponseInit {
  const response: CamsHttpResponse<T> = {
    headers: {},
    body: body ?? undefined,
    statusCode: body ? 200 : 204,
  };
  const init: HttpResponseInit = {
    headers: { ...commonHeaders, ...response.headers },
    status: response.statusCode,
  };
  if (response.body) init.jsonBody = response.body;

  return init;
}

// export function httpError(error: CamsError): CamsHttpResponse<CamsErrorBody> {
//   return {
//     headers: commonHeaders,
//     statusCode: error.status,
//     body: {
//       success: false,
//       message: error.message,
//     },
//   };
// }

export function httpError(error: CamsError): HttpResponseInit {
  return {
    headers: commonHeaders,
    status: error.status,
    jsonBody: {
      success: false,
      message: error.message,
    },
  };
}
