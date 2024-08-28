import { CamsError } from '../../common-errors/cams-error';

export const commonHeaders: Record<string, string> = {
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

export function httpSuccess<T extends object = undefined>(
  response: CamsHttpResponse<T> = { statusCode: 204 },
): CamsHttpResponse<T> {
  return {
    headers: { ...commonHeaders, ...response.headers },
    statusCode: response.statusCode ?? 200,
    body: response.body,
  };
}

export function httpError(error: CamsError): CamsHttpResponse<CamsErrorBody> {
  return {
    headers: commonHeaders,
    statusCode: error.status,
    body: {
      success: false,
      message: error.message,
    },
  };
}
