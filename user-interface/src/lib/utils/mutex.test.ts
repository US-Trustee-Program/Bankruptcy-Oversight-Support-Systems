import { describe } from 'vitest';

const MUTEX_NAME = 'test';

interface UseMutex {
  lock: () => string | null;
  unlock: (receipt: string) => void;
}

interface MutexModule {
  registerMutex: (name: string) => void;
  useMutex: (name: string) => UseMutex;
}

describe('Mutex', () => {
  let mutex: UseMutex;
  let module: MutexModule;

  beforeEach(async () => {
    vi.resetModules();
    module = await import('./mutex');
    module.registerMutex(MUTEX_NAME);
    mutex = module.useMutex(MUTEX_NAME);
  });

  test('should not throw an error if a mutex name is registered', () => {
    const mutex = module.useMutex(MUTEX_NAME);
    expect(mutex).not.toBeNull();
  });

  test('should throw an error if a mutex name is not registered', () => {
    expect(() => {
      module.useMutex('BadName');
    }).toThrow();
  });

  test('should provide lock', () => {
    const receipt = mutex.lock();
    expect(receipt).not.toBeNull();
  });

  test('should not provide lock if a lock already exists', () => {
    expect(mutex.lock()).not.toBeNull();
    expect(mutex.lock()).toBeNull();
    expect(mutex.lock()).toBeNull();
    expect(mutex.lock()).toBeNull();
  });

  test('should unlock an existing lock', () => {
    const receipt = mutex.lock();
    expect(receipt).not.toBeNull();
    mutex.unlock(receipt!);

    const receipt2 = mutex.lock();
    expect(receipt2).not.toBeNull();
  });
});
