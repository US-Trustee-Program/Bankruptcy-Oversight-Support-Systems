import { ResponseBody } from '../../../../../common/src/api/response';

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
  return {
    headers: { ...commonHeaders, ...response.headers },
    statusCode: response.statusCode ?? (response.body ? 200 : 204),
    body: response.body,
  };
}
