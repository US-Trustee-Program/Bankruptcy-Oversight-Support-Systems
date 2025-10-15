import { delay } from './delay';

describe('delay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test.each([
    [1000, undefined],
    [200, undefined],
  ])('resolves with undefined after %i ms when no function is provided', async (ms, fn) => {
    const promise = delay(ms, fn);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), ms);
    jest.advanceTimersByTime(ms);
    await expect(promise).resolves.toBeUndefined();
  });

  test.each([
    [500, () => 'foo', 'foo'],
    [300, () => 42, 42],
    [150, () => null, null],
    [250, () => ({ a: 1 }), { a: 1 }],
  ])('resolves with the return value of the function after %i ms', async (ms, fn, expected) => {
    const promise = delay(ms, fn);
    jest.advanceTimersByTime(ms);
    await expect(promise).resolves.toEqual(expected);
  });

  test.each([
    [500, jest.fn(() => 'bar'), 'bar'],
    [300, jest.fn(() => undefined), undefined],
  ])(
    'calls the optional function after %i ms and resolves with its return value',
    async (ms, fn, expected) => {
      const promise = delay(ms, fn);
      jest.advanceTimersByTime(ms);
      await expect(promise).resolves.toEqual(expected);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith();
    },
  );
});

describe('delay (generic return type)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('infers the correct type when a function returning a string is provided', async () => {
    const promise = delay(10, () => 'typed string');
    jest.advanceTimersByTime(10);
    const result = await promise;
    expect(typeof result).toBe('string');
    expect(result).toBe('typed string');
  });

  test('infers the correct type when a function returning a number is provided', async () => {
    const promise = delay(10, () => 123);
    jest.advanceTimersByTime(10);
    const result = await promise;
    expect(typeof result).toBe('number');
    expect(result).toBe(123);
  });

  test('infers the correct type when a function returning an object is provided', async () => {
    const obj = { foo: 'bar' };
    const promise = delay(10, () => obj);
    jest.advanceTimersByTime(10);
    const result = await promise;
    expect(result).toEqual(obj);
  });

  test('infers undefined when no function is provided', async () => {
    const promise = delay(10);
    jest.advanceTimersByTime(10);
    const result = await promise;
    expect(result).toBeUndefined();
  });

  test('infers undefined when a function returning undefined is provided', async () => {
    const promise = delay(10, () => undefined);
    jest.advanceTimersByTime(10);
    const result = await promise;
    expect(result).toBeUndefined();
  });

  test('works with explicit generic type argument', async () => {
    const promise = delay<number>(10, () => 999);
    jest.advanceTimersByTime(10);
    const result = await promise;
    expect(result).toBe(999);
  });
});
