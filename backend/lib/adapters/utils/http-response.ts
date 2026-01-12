import HttpStatusCodes from '@common/api/http-status-codes';
import { ResponseBody } from '@common/api/response';

export const commonHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'Last-Modified': Date.now().toString(),
};

export type CamsHttpResponseInit<T extends object = undefined> = {
  headers?: Record<string, string>;
  statusCode?: number;
  body?: ResponseBody<T>;
};

export function httpSuccess<T extends object = undefined>(
  response: CamsHttpResponseInit<T> = {},
): CamsHttpResponseInit<T> {
  const camsResponse: CamsHttpResponseInit<T> = {
    headers: { ...commonHeaders, ...response.headers },
    statusCode:
      response.statusCode ?? (response.body ? HttpStatusCodes.OK : HttpStatusCodes.NO_CONTENT),
  };
  if (response.body) {
    camsResponse.body = response.body;
  }
  return camsResponse;
}
