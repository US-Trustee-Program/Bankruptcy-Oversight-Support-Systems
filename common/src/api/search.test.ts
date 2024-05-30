import { setPaginationDefaults } from './search';
import { PaginationParameters } from './pagination';

describe('setPaginationDefaults tests', () => {
  test('should handle strings', () => {
    const input = { limit: '25', offset: '25' } as unknown as PaginationParameters;
    const expected = { limit: 25, offset: 25 };
    const actual = setPaginationDefaults(input);
    expect(actual).toEqual(expected);
  });

  test('should handle options', () => {
    const input = { limit: 25, offset: 25 };
    const expected = { limit: 25, offset: 25 };
    const actual = setPaginationDefaults(input);
    expect(actual).toEqual(expected);
  });

  test('should handle defaults', () => {
    const expected = { limit: 25, offset: 0 };
    const actual = setPaginationDefaults({});
    expect(actual).toEqual(expected);
  });

  test('should handle other search terms', () => {
    const input = { hello: 'world', limit: 25, offset: 50 } as PaginationParameters;
    const expected = { ...input, limit: 25, offset: 50 };
    const actual = setPaginationDefaults(input);
    expect(actual).toEqual(expected);
  });
});
