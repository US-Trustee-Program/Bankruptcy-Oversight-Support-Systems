import { UriString } from './common';
import { Pagination } from './pagination';

export type ResponseMetaData = {
  self: UriString;
};

export type ResponseBody<T = unknown> = {
  meta?: ResponseMetaData;
  pagination?: Pagination;
  data: T;
};
