export interface Closable {
  close: () => Promise<void>;
}

export interface DeferCloseAccumulator {
  closables: Closable[];
}

function isClosable(obj: unknown): obj is Closable {
  return typeof obj === 'object' && 'close' in obj;
}

function isDeferCloseAccumulator(obj: unknown): obj is DeferCloseAccumulator {
  return typeof obj === 'object' && 'closables' in obj;
}

export function deferClose(closable: unknown, accumulator: unknown = globalAccumulator): boolean {
  if (isDeferCloseAccumulator(accumulator)) {
    if (isClosable(closable)) {
      const priorLength = accumulator.closables.length;
      return accumulator.closables.push(closable) > priorLength;
    }
  }
}

export async function closeDeferred(accumulator: unknown = globalAccumulator): Promise<boolean> {
  if (isDeferCloseAccumulator(accumulator)) {
    let success = true;
    for (const closable of accumulator.closables) {
      try {
        await closable.close();
      } catch {
        success = false;
      }
    }
    return success;
  }
  return false;
}

const globalAccumulator: DeferCloseAccumulator = {
  closables: [],
};

async function closeGlobal() {
  closeDeferred();
}

// Guard against duplicate registration: this module's top-level code re-runs on every
// fresh module evaluation (e.g. once per test file under Vitest), but `process` itself
// is the same persistent object each time, so an unguarded process.on() here would stack
// a new set of listeners per evaluation instead of registering once for the process.
const SIGNAL_HANDLERS_REGISTERED = Symbol.for('cams.defer-close.signal-handlers-registered');
if (!(process as unknown as Record<symbol, boolean>)[SIGNAL_HANDLERS_REGISTERED]) {
  process.on('SIGINT', closeGlobal);
  process.on('SIGTERM', closeGlobal);
  process.on('exit', closeGlobal);
  (process as unknown as Record<symbol, boolean>)[SIGNAL_HANDLERS_REGISTERED] = true;
}
