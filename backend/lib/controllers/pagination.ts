import { Pagination } from '@common/api/pagination';

export function calculatePagination(
  dataCount: number,
  totalCount: number,
  limit: number,
  offset: number,
): Pagination {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / limit);

  return {
    count: dataCount,
    totalCount,
    currentPage,
    totalPages,
    limit,
  };
}
