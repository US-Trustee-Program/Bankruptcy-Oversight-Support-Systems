import { describe } from 'vitest';

const SEMAPHORE_NAME = 'test';

interface UseSemaphore {
  lock: () => string | null;
  unlock: (receipt: string) => void;
}

interface SemaphoreModule {
  registerSemaphore: (name: string) => void;
  useSemaphore: (name: string) => UseSemaphore;
}

describe('Semaphore', () => {
  let semaphore: UseSemaphore;
  let module: SemaphoreModule;

  beforeEach(async () => {
    vi.resetModules();
    module = await import('./semaphore');
    module.registerSemaphore(SEMAPHORE_NAME);
    semaphore = module.useSemaphore(SEMAPHORE_NAME);
  });

  test('should not throw an error if a semaphore name is registered', () => {
    const semaphore = module.useSemaphore(SEMAPHORE_NAME);
    expect(semaphore).not.toBeNull();
  });

  test('should throw an error if a semaphore name is not registered', () => {
    expect(() => {
      module.useSemaphore('BadName');
    }).toThrow();
  });

  test('should provide lock', () => {
    const receipt = semaphore.lock();
    expect(receipt).not.toBeNull();
  });

  test('should not provide lock if a lock already exists', () => {
    expect(semaphore.lock()).not.toBeNull();
    expect(semaphore.lock()).toBeNull();
    expect(semaphore.lock()).toBeNull();
    expect(semaphore.lock()).toBeNull();
  });

  test('should unlock an existing lock', () => {
    const receipt = semaphore.lock();
    expect(receipt).not.toBeNull();
    semaphore.unlock(receipt!);

    const receipt2 = semaphore.lock();
    expect(receipt2).not.toBeNull();
  });
});
