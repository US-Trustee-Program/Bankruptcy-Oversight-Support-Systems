import { describe, expect, vi, beforeEach } from 'vitest';
import LocalCache from './local-cache';

describe('LocalCache', () => {
  const mockStorage = new Map<string, string>();

  beforeEach(() => {
    // Mocking window.localStorage
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        mockStorage.set(key, value);
      },
      removeItem: (key: string) => {
        mockStorage.delete(key);
      },
      clear: () => {
        mockStorage.clear();
      },
      key: (index: number) => Object.keys(mockStorage)[index] || null,
      length: mockStorage.size,
    });
    // Clearing mockStorage before each test
    mockStorage.clear();
  });

  test('should store and retrieve cached values with a TTL', () => {
    const key = 'testKey';
    const value = 'testValue';
    const ttl = 2; // 2 seconds TTL

    LocalCache.set(key, value, ttl);
    const result = LocalCache.get(key);
    expect(result).toBe(value);
  });

  test('should return null if the cache is expired', () => {
    const key = 'expiredKey';
    const value = 'expiredValue';
    const ttl = 1; // 1 second TTL

    LocalCache.set(key, value, ttl);

    // Fast-forward time by 2 seconds
    vi.useFakeTimers();
    vi.advanceTimersByTime(2000);

    const result = LocalCache.get(key);
    expect(result).toBeNull();

    vi.useRealTimers();
  });

  test('should remove a cached entry', () => {
    const key = 'keyToRemove';
    const value = 'valueToRemove';

    LocalCache.set(key, value);
    LocalCache.remove(key);

    const result = LocalCache.get(key);
    expect(result).toBeNull();
  });

  test('should purge expired cache entries', () => {
    const validKey = 'validKey';
    const expiredKey = 'expiredKey';

    LocalCache.set(validKey, 'validValue', 5); // Valid for 5 seconds
    LocalCache.set(expiredKey, 'expiredValue', 1); // Valid for 1 second

    // Fast-forward time by 2 seconds (expired key should be removed)
    vi.useFakeTimers();
    vi.advanceTimersByTime(2000);

    LocalCache.purge();

    expect(LocalCache.get(validKey)).toBe('validValue');
    expect(LocalCache.get(expiredKey)).toBeNull();

    vi.useRealTimers();
  });

  test('should return false if localStorage is disabled', () => {
    vi.stubGlobal('localStorage', null);

    const result = LocalCache.set('disabledKey', 'disabledValue');
    expect(result).toBe(false);
  });

  test('should check if cache is enabled', () => {
    expect(LocalCache.isCacheEnabled()).toBeTruthy();
  });

  test('should safely handle exceptions', () => {
    const justThrow = vi.fn().mockImplementation(() => {
      throw new Error('Test Error');
    });
    vi.stubGlobal('localStorage', {
      getItem: justThrow,
      setItem: justThrow,
      removeItem: justThrow,
      clear: justThrow,
      key: justThrow,
      length: 0,
    });

    expect(() => {
      LocalCache.get('key');
    }).not.toThrow();
    expect(() => {
      LocalCache.set('key', 'value');
    }).not.toThrow();
    expect(() => {
      LocalCache.remove('key');
    }).not.toThrow();
    expect(() => {
      LocalCache.purge();
    }).not.toThrow();
  });
});
