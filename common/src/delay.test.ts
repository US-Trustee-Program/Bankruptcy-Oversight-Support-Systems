import { vi } from 'vitest';
import { delay } from './delay';

describe('delay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(global, 'setTimeout');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test.each([
    [1000, undefined],
    [200, undefined],
  ])('resolves with undefined after %i ms when no function is provided', async (ms, fn) => {
    const promise = delay(ms, fn);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), ms);
    vi.advanceTimersByTime(ms);
    await expect(promise).resolves.toBeUndefined();
  });

  test.each([
    [500, () => 'foo', 'foo'],
    [300, () => 42, 42],
    [150, () => null, null],
    [250, () => ({ a: 1 }), { a: 1 }],
  ])('resolves with the return value of the function after %i ms', async (ms, fn, expected) => {
    const promise = delay<ReturnType<typeof fn>>(ms, fn);
    vi.advanceTimersByTime(ms);
    await expect(promise).resolves.toEqual(expected);
  });

  test.each([
    [500, vi.fn(() => 'bar'), 'bar'],
    [300, vi.fn(() => undefined), undefined],
  ])(
    'calls the optional function after %i ms and resolves with its return value',
    async (ms, fn, expected) => {
      const promise = delay(ms, fn);
      vi.advanceTimersByTime(ms);
      await expect(promise).resolves.toEqual(expected);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith();
    },
  );
});

describe('delay (generic return type)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('infers the correct type when a function returning a string is provided', async () => {
    const promise = delay(10, () => 'typed string');
    vi.advanceTimersByTime(10);
    const result = await promise;
    expect(typeof result).toBe('string');
    expect(result).toBe('typed string');
  });

  test('infers the correct type when a function returning a number is provided', async () => {
    const promise = delay(10, () => 123);
    vi.advanceTimersByTime(10);
    const result = await promise;
    expect(typeof result).toBe('number');
    expect(result).toBe(123);
  });

  test('infers the correct type when a function returning an object is provided', async () => {
    const obj = { foo: 'bar' };
    const promise = delay(10, () => obj);
    vi.advanceTimersByTime(10);
    const result = await promise;
    expect(result).toEqual(obj);
  });

  test('infers undefined when no function is provided', async () => {
    const promise = delay(10);
    vi.advanceTimersByTime(10);
    const result = await promise;
    expect(result).toBeUndefined();
  });

  test('infers undefined when a function returning undefined is provided', async () => {
    const promise = delay(10, () => undefined);
    vi.advanceTimersByTime(10);
    const result = await promise;
    expect(result).toBeUndefined();
  });

  test('works with explicit generic type argument', async () => {
    const promise = delay<number>(10, () => 999);
    vi.advanceTimersByTime(10);
    const result = await promise;
    expect(result).toBe(999);
  });
});
