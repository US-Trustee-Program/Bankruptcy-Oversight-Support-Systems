import { UriString } from './common';

export type PaginationParameters = {
  limit?: number;
  offset?: number;
};

export type Pagination = {
  count: number;
  previous?: UriString;
  next?: UriString;
  limit: number;
  currentPage: number;
};
