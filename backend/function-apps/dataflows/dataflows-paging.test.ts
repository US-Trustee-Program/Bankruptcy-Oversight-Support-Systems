import { describe, test, expect } from 'vitest';
import { pageByByteBudget, AZURE_QUEUE_MESSAGE_LIMIT_BYTES } from './dataflows-paging';

describe('pageByByteBudget', () => {
  test('returns a single page when items fit within both budgets', () => {
    const items = [{ a: 1 }, { a: 2 }, { a: 3 }];

    const pages = pageByByteBudget(items, 100);

    expect(pages).toEqual([items]);
  });

  test('returns an empty array when given no items', () => {
    const pages = pageByByteBudget([], 100);

    expect(pages).toEqual([]);
  });

  test('pages by byte budget alone when maxPageSize is omitted', () => {
    const items = Array.from({ length: 500 }, (_, i) => ({ id: i }));

    const pages = pageByByteBudget(items);

    expect(pages).toEqual([items]);
  });

  test('splits into multiple pages when the count cap is reached', () => {
    const items = Array.from({ length: 101 }, (_, i) => ({ id: i }));

    const pages = pageByByteBudget(items, 100);

    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(100);
    expect(pages[1]).toHaveLength(1);
    expect(pages.flat()).toEqual(items);
  });

  test('splits into multiple pages when the byte budget is reached before the count cap', () => {
    const heavyItem = { id: 'x', padding: 'x'.repeat(1000) };
    const itemBytes = Buffer.byteLength(JSON.stringify(heavyItem));
    const countThatWouldExceedBudget = Math.ceil(AZURE_QUEUE_MESSAGE_LIMIT_BYTES / itemBytes) + 5;
    const items = Array.from({ length: countThatWouldExceedBudget }, () => ({ ...heavyItem }));

    const pages = pageByByteBudget(items, items.length);

    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flat()).toEqual(items);
    for (const page of pages) {
      const pageBase64Bytes = Math.ceil(
        Buffer.byteLength(JSON.stringify({ events: page })) * (4 / 3),
      );
      expect(pageBase64Bytes).toBeLessThanOrEqual(AZURE_QUEUE_MESSAGE_LIMIT_BYTES);
    }
  });

  test('places a single oversized item alone in its own page rather than dropping or erroring', () => {
    const oversized = { id: 'huge', padding: 'x'.repeat(AZURE_QUEUE_MESSAGE_LIMIT_BYTES) };
    const items = [{ id: 'small' }, oversized, { id: 'small2' }];

    const pages = pageByByteBudget(items, 100);

    expect(pages.flat()).toEqual(items);
    expect(pages.some((page) => page.length === 1 && page[0] === oversized)).toBe(true);
  });
});
