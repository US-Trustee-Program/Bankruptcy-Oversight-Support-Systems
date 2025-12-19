import { DeferCloseAccumulator } from './defer-close';
import { DeferReleaseAccumulator } from './defer-release';
import { finalizeDeferrable } from './finalize-deferrable';
import * as DeferCloseModule from './defer-close';
import * as DeferReleaseModule from './defer-release';

describe('Finalize deferrable', () => {
  test('should call closeDeferred and releaseDeferred', async () => {
    const closeDeferred = vi.spyOn(DeferCloseModule, 'closeDeferred').mockResolvedValue(undefined);
    const releaseDeferred = vi
      .spyOn(DeferReleaseModule, 'releaseDeferred')
      .mockResolvedValue(undefined);

    interface JoinedAccumulator extends DeferCloseAccumulator, DeferReleaseAccumulator {}
    const accumulator: JoinedAccumulator = {
      closables: [],
      releasables: [],
    };
    await finalizeDeferrable(accumulator);

    expect(closeDeferred).toHaveBeenLastCalledWith(accumulator);
    expect(releaseDeferred).toHaveBeenLastCalledWith(accumulator);
  });
});
