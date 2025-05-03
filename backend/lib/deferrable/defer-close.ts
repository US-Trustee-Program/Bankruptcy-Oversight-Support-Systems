export interface Closable {
  close: () => Promise<void>;
}

export interface DeferCloseAccumulator {
  closables: Closable[];
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

export function deferClose(closable: unknown, accumulator: unknown = globalAccumulator): boolean {
  if (isDeferCloseAccumulator(accumulator)) {
    if (isClosable(closable)) {
      const priorLength = accumulator.closables.length;
      return accumulator.closables.push(closable) > priorLength;
    }
  }
}

function isClosable(obj: unknown): obj is Closable {
  return typeof obj === 'object' && 'close' in obj;
}

function isDeferCloseAccumulator(obj: unknown): obj is DeferCloseAccumulator {
  return typeof obj === 'object' && 'closables' in obj;
}

const globalAccumulator: DeferCloseAccumulator = {
  closables: [],
};

async function closeGlobal() {
  closeDeferred();
}

process.on('SIGINT', closeGlobal);
process.on('SIGTERM', closeGlobal);
process.on('exit', closeGlobal);
