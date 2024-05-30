import { UriString } from './common';
import { NoPagination, Pagination, WithPagination } from './pagination';
import { DEFAULT_SEARCH_LIMIT } from './search';

export type ResponseMetaData = Pagination & {
  self: UriString;
};

export type ResponseBodySuccess<T = unknown> = {
  meta: ResponseMetaData;
  isSuccess: true;
  data: T;
};

export type ResponseBodyError<E extends Error = Error> = {
  meta: ResponseMetaData;
  isSuccess: false;
  error: E;
};

export type ResponseBody<T = unknown> = ResponseBodySuccess<T> | ResponseBodyError;

function isResponseBody(body: unknown): body is ResponseBody {
  return typeof body === 'object' && body !== null && 'isSuccess' in body;
}

export function isResponseBodyError(body: unknown): body is ResponseBodyError {
  return isResponseBody(body) && body.isSuccess === false && 'error' in body;
}

export function isResponseBodySuccess<T>(body: unknown): body is ResponseBodySuccess<T> {
  return isResponseBody(body) && body.isSuccess === true && 'data' in body;
}

export function buildResponseBodySuccess<T = unknown>(
  data: T,
  meta: Partial<ResponseMetaData> = {},
): ResponseBodySuccess<T> {
  let withPagination: WithPagination = undefined;
  let noPagination: NoPagination = undefined;

  const { isPaginated: _, ...otherMeta } = meta;
  const count = Array.isArray(data) ? data.length : 0;
  const currentPage = Array.isArray(data) ? (data.length ? 1 : 0) : 0;

  if (
    ('isPaginated' in meta && meta.isPaginated) ||
    (Array.isArray(data) && meta.isPaginated === undefined)
  ) {
    withPagination = {
      isPaginated: true,
      count,
      currentPage,
      limit: DEFAULT_SEARCH_LIMIT,
      self: 'self-link',
      ...otherMeta,
    };
  } else {
    noPagination = { isPaginated: false, self: 'self-link', ...otherMeta };
  }
  const newMeta = { self: meta.self ?? 'self-link', ...withPagination, ...noPagination };
  return {
    meta: newMeta,
    isSuccess: true,
    data,
  };
}
