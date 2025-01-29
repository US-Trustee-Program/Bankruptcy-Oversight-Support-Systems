import { findFirstByDate, findLastByDate } from './bisect';

describe('bisect tests', () => {
  test('should find 10 for first 12-13', () => {
    expect(findFirstByDate(1, 24, '2024-12-13')).toEqual(10);
  });

  test('should find 12 for last 12-13', () => {
    expect(findLastByDate(1, 24, '2024-12-13')).toEqual(12);
  });

  test('should find 16 for first 12-15', () => {
    expect(findFirstByDate(1, 24, '2024-12-15')).toEqual(16);
  });

  test('should find 18 for last 12-15', () => {
    expect(findLastByDate(1, 24, '2024-12-15')).toEqual(18);
  });

  test('should find 24 for first 12-19', () => {
    expect(findFirstByDate(1, 24, '2024-12-15')).toEqual(16);
  });

  test('should find 24 for last 12-19', () => {
    expect(findLastByDate(1, 24, '2024-12-19')).toEqual(24);
  });

  test('should find 1 for first 12-10', () => {
    expect(findFirstByDate(1, 24, '2024-12-10')).toEqual(1);
  });

  test('should find 3 for last 12-10', () => {
    expect(findLastByDate(1, 24, '2024-12-10')).toEqual(3);
  });
});
