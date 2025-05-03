import { UriString } from './common';
import { Pagination } from './pagination';

export type ResponseBody<T = unknown> = {
  data: T;
  meta?: ResponseMetaData;
  pagination?: Pagination;
};

export type ResponseMetaData = {
  self: UriString;
};
