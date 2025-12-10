import { vi } from 'vitest';
import { Releasable } from '../use-cases/gateways.types';
import { deferRelease, DeferReleaseAccumulator, releaseDeferred } from './defer-release';

describe('Defer Release', () => {
  test('should add a releasable object to an accumulator', async () => {
    const closable: Releasable = {
      release: async () => {},
    };
    const accumulator: DeferReleaseAccumulator = {
      releasables: [],
    };
    const success = deferRelease(accumulator, closable);

    expect(success).toBeTruthy();
    expect(accumulator.releasables.length).toEqual(1);
  });

  test('should call release on deferred releasables', async () => {
    const release = vi.fn();
    const releasable: Releasable = {
      release,
    };
    const accumulator: DeferReleaseAccumulator = {
      releasables: [releasable],
    };

    const success = releaseDeferred(accumulator);

    expect(success).toBeTruthy();
    expect(accumulator.releasables.length).toEqual(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  test('should not fail if a proper accumulator is not passed', async () => {
    await expect(releaseDeferred({})).resolves.toBeFalsy();
  });

  test('should silently handle release errors', async () => {
    const release = vi.fn().mockRejectedValue(new Error('some error'));
    const releasable: Releasable = {
      release,
    };
    const accumulator: DeferReleaseAccumulator = {
      releasables: [releasable],
    };

    const success = await releaseDeferred(accumulator);

    expect(success).toBeFalsy();
    expect(accumulator.releasables.length).toEqual(1);
    expect(release).toHaveBeenCalledTimes(1);
  });
});
