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

export type CosmosPagination = Pagination & {
  totalPages?: number; // change to required once we finalize implementation of Cosmos specific pagination
};

export type CosmosPaginationResponse<T> = {
  metadata?: { total: number; limit: number; offset: number };
  data: T[];
};
