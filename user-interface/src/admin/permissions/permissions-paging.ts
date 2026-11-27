import { PaginationParameters } from '@common/api/pagination';

// CAMS Users and Change History page through the same number of rows.
export const PERMISSIONS_PAGE_SIZE = 20;

export type PagePredicate = Required<PaginationParameters>;
