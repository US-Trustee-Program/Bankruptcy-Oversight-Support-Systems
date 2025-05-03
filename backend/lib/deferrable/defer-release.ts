import { Releasable } from '../use-cases/gateways.types';

export interface DeferReleaseAccumulator {
  releasables: Releasable[];
}

export function deferRelease(accumulator: unknown, releasable: unknown): boolean {
  if (isDeferReleaseAccumulator(accumulator)) {
    if (isReleasable(releasable)) {
      const priorLength = accumulator.releasables.length;
      return accumulator.releasables.push(releasable) > priorLength;
    }
  }
}

export async function releaseDeferred(accumulator: unknown): Promise<boolean> {
  if (isDeferReleaseAccumulator(accumulator)) {
    let success = true;
    for (const releasable of accumulator.releasables) {
      try {
        await releasable.release();
      } catch {
        success = false;
      }
    }
    return success;
  }
  return false;
}

function isDeferReleaseAccumulator(obj: unknown): obj is DeferReleaseAccumulator {
  return typeof obj === 'object' && 'releasables' in obj;
}

function isReleasable(obj: unknown): obj is Releasable {
  return typeof obj === 'object' && 'release' in obj;
}
