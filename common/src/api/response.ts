import { UriString } from './common';
import { Pagination } from './pagination';

export type ErrorBody = {
  message: string;
};

export type ResponseMetaData = {
  self: UriString;
};

export type ResponseBody<T = unknown> = {
  meta?: ResponseMetaData;
  pagination?: Pagination;
  data: T;
};
