import { UriString } from './common';
import { Pagination } from './pagination';

export type ResponseMetaData = Pagination & {
  self: UriString;
};

export type ResponseBodySuccess<T = unknown> = {
  meta: ResponseMetaData;
  isSuccess: true;
  data: T; // TODO: How would we handle a HTTP 201??
};

export type ResponseBodyError<E extends Error = Error> = {
  meta: ResponseMetaData;
  isSuccess: false;
  error: E;
};

export type ResponseBody<T = unknown> = ResponseBodySuccess<T> | ResponseBodyError;

function isResponseBody(body: unknown): body is ResponseBody {
  return typeof body === 'object' && 'isSuccess' in body;
}

export function isResponseBodyError(body: unknown): body is ResponseBodyError {
  return isResponseBody(body) && body.isSuccess === false && 'error' in body;
}

export function isResponseBodySuccess<T>(body: unknown): body is ResponseBodySuccess<T> {
  return isResponseBody(body) && body.isSuccess === true && 'data' in body;
}
