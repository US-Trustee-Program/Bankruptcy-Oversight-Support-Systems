import { UriString } from './common';

export type Pagination = {
  count: number;
  currentPage: number;
  limit: number;
  next?: UriString;
  previous?: UriString;
  totalCount?: number;
  totalPages?: number;
};

export type PaginationParameters = {
  limit?: number;
  offset?: number;
};
