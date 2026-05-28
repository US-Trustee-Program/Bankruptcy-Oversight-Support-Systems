import { calculatePagination } from './pagination';

describe('calculatePagination', () => {
  test('should return page 1 of 1 when totalCount is zero', () => {
    const result = calculatePagination(0, 0, 25, 0);

    expect(result).toEqual({
      count: 0,
      totalCount: 0,
      currentPage: 1,
      totalPages: 1,
      limit: 25,
    });
  });

  test('should calculate correct page for given offset and limit', () => {
    const result = calculatePagination(10, 50, 10, 20);

    expect(result).toEqual({
      count: 10,
      totalCount: 50,
      currentPage: 3,
      totalPages: 5,
      limit: 10,
    });
  });

  test('should calculate totalPages rounding up for partial last page', () => {
    const result = calculatePagination(25, 30, 25, 0);

    expect(result).toEqual({
      count: 25,
      totalCount: 30,
      currentPage: 1,
      totalPages: 2,
      limit: 25,
    });
  });
});
