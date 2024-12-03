import { Closable, closeDeferred, deferClose, DeferCloseAccumulator } from './defer-close';

describe('Defer Close', () => {
  test('should add a closable object to an accumulator', async () => {
    const closable: Closable = {
      close: async () => {},
    };
    const accumulator: DeferCloseAccumulator = {
      closables: [],
    };
    const success = deferClose(accumulator, closable);

    expect(success).toBeTruthy();
    expect(accumulator.closables.length).toEqual(1);
  });

  test('should call close on deferred closables', async () => {
    const close = jest.fn();
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
    expect(closeDeferred({})).resolves.toBeFalsy();
  });

  test('should silently handle close errors', async () => {
    const close = jest.fn().mockRejectedValue(new Error('some error'));
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
});
