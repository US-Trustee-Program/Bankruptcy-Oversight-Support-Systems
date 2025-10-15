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
  ])('resolves after %i ms (optional function: %p)', async (ms, fn) => {
    const promise = delay(ms, fn);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), ms);
    jest.advanceTimersByTime(ms);
    await expect(promise).resolves.toBeUndefined();
  });

  test.each([
    [500, jest.fn()],
    [300, jest.fn()],
  ])('calls the optional function after %i ms', async (ms, fn) => {
    const promise = delay(ms, fn);
    jest.advanceTimersByTime(ms);
    await promise;
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith();
  });
});
