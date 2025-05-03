import { DeferCloseAccumulator } from './defer-close';
import * as DeferCloseModule from './defer-close';
import { DeferReleaseAccumulator } from './defer-release';
import * as DeferReleaseModule from './defer-release';
import { finalizeDeferrable } from './finalize-deferrable';

describe('Finalize deferrable', () => {
  test('should call closeDeferred and releaseDeferred', async () => {
    const closeDeferred = jest
      .spyOn(DeferCloseModule, 'closeDeferred')
      .mockResolvedValue(undefined);
    const releaseDeferred = jest
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
