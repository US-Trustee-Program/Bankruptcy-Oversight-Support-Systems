// TODO: Maybe this should be delegated to local storage... WHat happens if the map is scoped to unique tabs/windows if modules are not shared between tabs/windows?
const allLocks = new Map<string, string[]>();

export function registerSemaphore(name: string) {
  if (!allLocks.has(name)) {
    allLocks.set(name, []);
  }
}

export function useSemaphore(name: string) {
  if (!allLocks.has(name)) {
    throw new Error(`Lock not registered for "${name}"`);
  }
  const locks = allLocks.get(name)!;

  function lock() {
    const receipt = crypto.randomUUID();
    locks.push(receipt);

    if (locks[0] === receipt) {
      return receipt;
    } else {
      locks.pop();
      return null;
    }
  }

  function unlock(receipt: string) {
    if (locks[0] === receipt) {
      locks.shift();
    }
  }

  return {
    lock,
    unlock,
  };
}
