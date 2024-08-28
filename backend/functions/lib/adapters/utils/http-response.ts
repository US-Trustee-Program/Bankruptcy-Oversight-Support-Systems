import { isCamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';

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
  response: CamsHttpResponse<T> = {},
): CamsHttpResponse<T> {
  return {
    headers: { ...commonHeaders, ...response.headers },
    statusCode: response.statusCode ?? (response.body ? 200 : 204),
    body: response.body,
  };
}

export function httpError(
  originalError: Error,
  moduleName: string = 'FIX-THIS-MAPPING-OR-YOU-WILL-GET-A-STRONGLY-WORDED-REBUKE',
): CamsHttpResponse<CamsErrorBody> {
  const error = isCamsError(originalError)
    ? originalError
    : new UnknownError(moduleName, { originalError });
  return {
    headers: commonHeaders,
    statusCode: error.status,
    body: {
      success: false,
      message: error.message,
    },
  };
}
