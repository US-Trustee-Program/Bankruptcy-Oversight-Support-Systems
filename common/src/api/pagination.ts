import { UriString } from './common';

export type PaginationParameters = {
  limit?: number;
  offset?: number;
};

export type NoPagination = {
  isPaginated: false;
};

export type WithPagination = {
  isPaginated: true;
  count: number;
  previous?: UriString;
  next?: UriString;
  // total?: number; // need to query for a total. Yuck?
  limit: number;
  currentPage: number;
  // key: Key;
};

export type Pagination = WithPagination | NoPagination;

export function isPaginated(meta: unknown): meta is WithPagination {
  return typeof meta === 'object' && 'isPaginated' in meta && meta.isPaginated === true;
}