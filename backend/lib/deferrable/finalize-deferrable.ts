import { closeDeferred, DeferCloseAccumulator } from './defer-close';
import { DeferReleaseAccumulator, releaseDeferred } from './defer-release';

export async function finalizeDeferrable(
  accumulator: DeferCloseAccumulator | DeferReleaseAccumulator,
) {
  await closeDeferred(accumulator);
  await releaseDeferred(accumulator);
}
