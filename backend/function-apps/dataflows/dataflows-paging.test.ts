import { describe, test, expect } from 'vitest';
import { pageByByteBudget, AZURE_QUEUE_MESSAGE_LIMIT_BYTES } from './dataflows-paging';

describe('pageByByteBudget', () => {
  test('returns a single page when items fit within both budgets', () => {
    const items = [{ a: 1 }, { a: 2 }, { a: 3 }];

    const { pages, rejected } = pageByByteBudget(items, 100);

    expect(pages).toEqual([items]);
    expect(rejected).toEqual([]);
  });

  test('returns an empty array when given no items', () => {
    const { pages, rejected } = pageByByteBudget([], 100);

    expect(pages).toEqual([]);
    expect(rejected).toEqual([]);
  });

  test('pages by byte budget alone when maxPageSize is omitted', () => {
    const items = Array.from({ length: 500 }, (_, i) => ({ id: i }));

    const { pages, rejected } = pageByByteBudget(items);

    expect(pages).toEqual([items]);
    expect(rejected).toEqual([]);
  });

  test('splits into multiple pages when the count cap is reached', () => {
    const items = Array.from({ length: 101 }, (_, i) => ({ id: i }));

    const { pages, rejected } = pageByByteBudget(items, 100);

    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(100);
    expect(pages[1]).toHaveLength(1);
    expect(pages.flat()).toEqual(items);
    expect(rejected).toEqual([]);
  });

  test('splits into multiple pages when the byte budget is reached before the count cap', () => {
    const heavyItem = { id: 'x', padding: 'x'.repeat(1000) };
    const itemBytes = Buffer.byteLength(JSON.stringify(heavyItem));
    const countThatWouldExceedBudget = Math.ceil(AZURE_QUEUE_MESSAGE_LIMIT_BYTES / itemBytes) + 5;
    const items = Array.from({ length: countThatWouldExceedBudget }, () => ({ ...heavyItem }));

    const { pages, rejected } = pageByByteBudget(items, items.length);

    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flat()).toEqual(items);
    expect(rejected).toEqual([]);
    for (const page of pages) {
      const pageBase64Bytes = Math.ceil(
        Buffer.byteLength(JSON.stringify({ events: page })) * (4 / 3),
      );
      expect(pageBase64Bytes).toBeLessThanOrEqual(AZURE_QUEUE_MESSAGE_LIMIT_BYTES);
    }
  });

  test('rejects a single item whose own size alone exceeds the byte budget, rather than paging it', () => {
    const oversized = { id: 'huge', padding: 'x'.repeat(AZURE_QUEUE_MESSAGE_LIMIT_BYTES) };
    const items = [{ id: 'small' }, oversized, { id: 'small2' }];

    const { pages, rejected } = pageByByteBudget(items, 100);

    expect(rejected).toEqual([oversized]);
    expect(pages.flat()).toEqual([{ id: 'small' }, { id: 'small2' }]);
  });

  test('collects every oversized item into rejected while still paging the rest normally', () => {
    const oversizedA = { id: 'huge-a', padding: 'x'.repeat(AZURE_QUEUE_MESSAGE_LIMIT_BYTES) };
    const oversizedB = { id: 'huge-b', padding: 'x'.repeat(AZURE_QUEUE_MESSAGE_LIMIT_BYTES) };
    const items = [{ id: 'small' }, oversizedA, { id: 'small2' }, oversizedB];

    const { pages, rejected } = pageByByteBudget(items, 100);

    expect(rejected).toEqual([oversizedA, oversizedB]);
    expect(pages.flat()).toEqual([{ id: 'small' }, { id: 'small2' }]);
  });

  // Regression test for a real RequestBodyTooLarge (413) production failure: the old
  // implementation budgeted by summing each item's own serialized size, which ignores the
  // array's own overhead (`,` separators, `[`/`]` brackets). That overhead is negligible per
  // item but accumulates across a large page of small, unpadded items — unlike the other tests
  // here, which use a few artificially padded heavy items and would pass under either
  // implementation. With enough small items, the accumulated separator/bracket overhead alone
  // is enough to push a page's real serialized size past PAGE_BYTE_BUDGET even though the sum
  // of individual item sizes stays under budget.
  test('keeps every page within the real byte budget for many small unpadded items', () => {
    const item = {
      trusteeApptId: '507f1f77bcf86cd799439011', // pragma: allowlist secret
      caseApptId: '507f1f77bcf86cd799439012', // pragma: allowlist secret
    };
    const itemBytes = Buffer.byteLength(JSON.stringify(item));
    // Chosen so that sum(itemBytes) alone lands just under PAGE_BYTE_BUDGET (48128), while the
    // real serialized array — which also includes 1 pair of brackets and (count - 1) commas —
    // lands over it. This is exactly the gap the old per-item-sum logic missed.
    const count = Math.floor(48128 / itemBytes);
    const items = Array.from({ length: count }, () => ({ ...item }));
    const sumOfItemBytes = count * itemBytes;
    const realArrayBytes = Buffer.byteLength(JSON.stringify(items));
    expect(sumOfItemBytes).toBeLessThanOrEqual(48128);
    expect(realArrayBytes).toBeGreaterThan(48128);

    const { pages, rejected } = pageByByteBudget(items);

    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flat()).toEqual(items);
    expect(rejected).toEqual([]);
    for (const page of pages) {
      expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThanOrEqual(48128);
    }
  });
});
