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

export function deferClose(accumulator: unknown, closable: unknown): boolean {
  if (isDeferCloseAccumulator(accumulator)) {
    if (isClosable(closable)) {
      const priorLength = accumulator.closables.length;
      return accumulator.closables.push(closable) > priorLength;
    }
  }
}

export async function closeDeferred(accumulator: unknown): Promise<boolean> {
  if (isDeferCloseAccumulator(accumulator)) {
    let success = true;
    for (const closable of accumulator.closables) {
      try {
        await closable.close();
      } catch (e) {
        success = false;
      }
    }
    return success;
  }
  return false;
}
