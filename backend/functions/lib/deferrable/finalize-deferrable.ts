import { closeDeferred, DeferCloseAccumulator } from './defer-close';
import { DeferReleaseAccumulator, releaseDeferred } from './defer-release';
import { LoggerHelper } from '../adapters/types/basic';

export async function finalizeDeferrable(
  accumulator: DeferCloseAccumulator | DeferReleaseAccumulator,
) {
  const logger = accumulator['logger'] as LoggerHelper;
  logger.debug('FINALIZE_DEFERRABLE', '!!!!!!!!!!!!!!!Finalize deferrable!!!!!!!!!!!!!!!');
  await closeDeferred(accumulator);
  await releaseDeferred(accumulator);
}
