import { CamsError } from '../../common-errors/cams-error';

const commonHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'Last-Modified': Date.toString(),
};

export type CamsErrorBody = {
  success: false;
  message: string;
};

export type CamsHttpResponse<T> = {
  headers: Record<string, string>;
  statusCode: number;
  body: T;
};

export function httpSuccess<T extends object = undefined>(
  params: { body?: T; statusCode?: number } = { statusCode: 204 },
): CamsHttpResponse<T> {
  return {
    headers: commonHeaders,
    statusCode: params.statusCode ?? 200,
    body: params.body,
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
