import { vi } from 'vitest';
import { Closable, closeDeferred, deferClose, DeferCloseAccumulator } from './defer-close';

describe('Defer Close', () => {
  test('should add a closable object to an accumulator', async () => {
    const closable: Closable = {
      close: async () => {},
    };
    const accumulator: DeferCloseAccumulator = {
      closables: [],
    };
    const success = deferClose(closable, accumulator);

    expect(success).toBeTruthy();
    expect(accumulator.closables.length).toEqual(1);
  });

  test('should call close on deferred closables', async () => {
    const close = vi.fn();
    const closable: Closable = {
      close,
    };
    const accumulator: DeferCloseAccumulator = {
      closables: [closable],
    };

    const success = closeDeferred(accumulator);

    expect(success).toBeTruthy();
    expect(accumulator.closables.length).toEqual(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  test('should not fail if a proper accumulator is not passed', async () => {
    await expect(closeDeferred({})).resolves.toBeFalsy();
  });

  test('should silently handle close errors', async () => {
    const close = vi.fn().mockRejectedValue(new Error('some error'));
    const closable: Closable = {
      close,
    };
    const accumulator: DeferCloseAccumulator = {
      closables: [closable],
    };

    const success = await closeDeferred(accumulator);

    expect(success).toBeFalsy();
    expect(accumulator.closables.length).toEqual(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  test('should close deferred on SIGINT with the module scoped accumulator', async () => {
    const close = vi.fn();
    const closable: Closable = {
      close,
    };

    deferClose(closable);
    process.emit('SIGINT');

    expect(close).toHaveBeenCalledTimes(1);
  });

  // TODO: Figure out how to test SIGTERM and exit
});
