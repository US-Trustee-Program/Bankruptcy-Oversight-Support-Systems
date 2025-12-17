import { describe, expect, vi, beforeEach } from 'vitest';
import LocalCache from './local-cache';
import { mockLocalStorage } from '../testing/mock-local-storage';

describe('LocalCache', () => {
  const cacheItem = {
    foo: 'bar',
  };

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('localStorage', mockLocalStorage);
    window.CAMS_CONFIGURATION = {
      ...window.CAMS_CONFIGURATION,
      CAMS_DISABLE_LOCAL_CACHE: 'false',
    };
    const reloaded = await import('./local-cache');
    expect(reloaded.default.isCacheEnabled()).toBeTruthy();
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  test('should remove all cached values', () => {
    const keys = ['test1', 'test2', 'test3'];
    keys.forEach((key) => {
      LocalCache.set(key, {});
    });
    expect(mockLocalStorage.length).toEqual(keys.length);

    LocalCache.removeAll();
    expect(mockLocalStorage.length).toEqual(0);
  });

  test('should purge only items with valid keys and expired cache', async () => {
    const randomKey = 'some:random:key:';
    const camsKey = 'cams:cache:';
    const mockCamsValue1 = {
      expiresAfter: 123,
      value: 'some valid data 1',
    };
    const mockCamsValue2 = {
      expiresAfter: 123,
      value: 'some valid data 2',
    };
    mockLocalStorage.setItem(randomKey + 'one', 'some random value 1');
    mockLocalStorage.setItem(randomKey + 'two', 'some random value 2');
    mockLocalStorage.setItem(camsKey + 'one', JSON.stringify(mockCamsValue1));
    mockLocalStorage.setItem(camsKey + 'two', JSON.stringify(mockCamsValue2));

    let keys = Array.from(mockLocalStorage.store.keys());
    expect(keys.length).toEqual(4);
    expect(keys).toContain(randomKey + 'one');
    expect(keys).toContain(randomKey + 'two');
    expect(keys).toContain(camsKey + 'one');
    expect(keys).toContain(camsKey + 'two');
    expect(mockLocalStorage.getItem(camsKey + 'one')).toEqual(JSON.stringify(mockCamsValue1));

    LocalCache.purge();

    keys = Array.from(mockLocalStorage.store.keys());
    expect(keys.length).toEqual(2);
    expect(keys).toContain(randomKey + 'one');
    expect(keys).toContain(randomKey + 'two');
    expect(keys).not.toContain(camsKey + 'one');
    expect(keys).not.toContain(camsKey + 'two');

    expect(mockLocalStorage.getItem(camsKey + 'one')).toEqual(null);
  });

  test('should properly catch error and call console.error in purge', async () => {
    const getItemMock = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('getItem failed');
    });
    const consoleMock = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mockCamsValue1 = {
      expiresAfter: 123,
      value: 'some valid data 1',
    };
    const camsKey = 'cams:cache:';
    mockLocalStorage.setItem(camsKey + 'one', JSON.stringify(mockCamsValue1));
    mockLocalStorage.setItem(camsKey + 'two', JSON.stringify(mockCamsValue1));

    LocalCache.purge();

    expect(console.error).toHaveBeenCalledWith(
      'Purging cache in local storage failed:',
      expect.any(Error),
    );

    getItemMock.mockRestore();
    consoleMock.mockRestore();
  });

  test('should remove all cached values for a given namespace', () => {
    const namespace = 'test:';
    const keysNotInNamespace = ['foo', 'bar'];
    const keys = [namespace + '1', namespace + '2', namespace + '3', ...keysNotInNamespace];
    keys.forEach((key) => {
      LocalCache.set(key, {});
    });
    expect(mockLocalStorage.length).toEqual(keys.length);

    LocalCache.removeNamespace(namespace);
    expect(mockLocalStorage.length).toEqual(keysNotInNamespace.length);
  });

  test('should store and retrieve cached values with a TTL', () => {
    const key = 'testKey';
    const value = 'testValue';
    const ttl = 2; // 2 seconds TTL

    LocalCache.set(key, value, ttl);
    const result = LocalCache.get(key);
    expect(result).toEqual({ value, expiresAfter: expect.any(Number) });
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
    const otherNonCacheKey = 'someOtherKey';

    window.localStorage.setItem(otherNonCacheKey, 'test');
    LocalCache.set(validKey, 'validValue', 5); // Valid for 5 seconds
    LocalCache.set(expiredKey, 'expiredValue', 1); // Valid for 1 second

    // Fast-forward time by 2 seconds (expired key should be removed)
    vi.useFakeTimers();
    vi.advanceTimersByTime(2000);

    LocalCache.purge();

    expect(LocalCache.get(validKey)).toEqual({
      value: 'validValue',
      expiresAfter: expect.any(Number),
    });
    expect(LocalCache.get(expiredKey)).toBeNull();
    expect(window.localStorage.getItem(otherNonCacheKey)).toEqual('test');

    window.localStorage.removeItem(otherNonCacheKey);
    vi.useRealTimers();
  });

  test('should check if cache is disabled if the local storage API is not available', async () => {
    vi.stubGlobal('localStorage', null);
    vi.resetModules();
    const reloaded = await import('./local-cache');
    expect(reloaded.default.isCacheEnabled()).toBeFalsy();
  });

  test('should check if cache is disabled if the CAMS_DISABLE_LOCAL_CACHE config is true', async () => {
    vi.resetModules();
    vi.stubGlobal('localStorage', mockLocalStorage);
    window.CAMS_CONFIGURATION = {
      ...window.CAMS_CONFIGURATION,
      CAMS_DISABLE_LOCAL_CACHE: 'true',
    };
    const reloaded = await import('./local-cache');
    expect(reloaded.default.isCacheEnabled()).toBeFalsy();
  });

  test('should check if cache is enabled', async () => {
    vi.resetModules();
    vi.stubGlobal('localStorage', mockLocalStorage);
    const reloaded = await import('./local-cache');
    expect(reloaded.default.isCacheEnabled()).toBeTruthy();
  });

  test('should return false if localStorage is disabled', () => {
    vi.stubGlobal('localStorage', null);

    const result = LocalCache.getByKeyPattern(/^foo/);
    expect(result).toHaveLength(0);
  });

  test('should return empty array if localStorage is disabled', () => {
    vi.stubGlobal('localStorage', null);

    const result = LocalCache.set('disabledKey', 'disabledValue');
    expect(result).toBe(false);
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

    const calls = [
      () => LocalCache.get('key'),
      () => LocalCache.set('key', 'value'),
      () => LocalCache.purge(),
    ];
    calls.forEach((call) => {
      expect(call).not.toThrow();
    });
  });

  test('should return empty array when no items exist', () => {
    const pattern = /^foo/;
    const result = LocalCache.getByKeyPattern(pattern);
    expect(result).toEqual([]);
  });

  test('should return empty array when no items match pattern', () => {
    // Save items with keys that don't match the pattern
    LocalCache.set('bar1', cacheItem);
    LocalCache.set('bar2', cacheItem);
    LocalCache.set('baz', cacheItem);

    const pattern = /^foo/;
    const result = LocalCache.getByKeyPattern(pattern);
    expect(result).toEqual([]);
  });

  test('should return matching items when some items match pattern', () => {
    LocalCache.set('foo1', { id: 1 });
    LocalCache.set('foo2', { id: 2 });
    LocalCache.set('bar', { id: 3 });

    const pattern = /^foo/;
    const result = LocalCache.getByKeyPattern(pattern);

    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        { key: 'foo1', item: { value: { id: 1 }, expiresAfter: expect.any(Number) } },
        { key: 'foo2', item: { value: { id: 2 }, expiresAfter: expect.any(Number) } },
      ]),
    );
  });

  test('should return all items when all items match pattern', () => {
    // Save items with keys that all match the pattern
    LocalCache.set('case-notes-123', { id: 1 });
    LocalCache.set('case-notes-456', { id: 2 });
    LocalCache.set('case-notes-789', { id: 3 });

    const pattern = /^case-notes-/;
    const result = LocalCache.getByKeyPattern(pattern);

    expect(result).toHaveLength(3);
    expect(result).toEqual(
      expect.arrayContaining([
        { key: 'case-notes-123', item: { value: { id: 1 }, expiresAfter: expect.any(Number) } },
        { key: 'case-notes-456', item: { value: { id: 2 }, expiresAfter: expect.any(Number) } },
        { key: 'case-notes-789', item: { value: { id: 3 }, expiresAfter: expect.any(Number) } },
      ]),
    );
  });

  test('should match items using complex regex patterns', () => {
    // Save items with various keys
    LocalCache.set('case-notes-123', { id: 1 });
    LocalCache.set('case-notes-456', { id: 2 });
    LocalCache.set('other-form-789', { id: 3 });
    LocalCache.set('form-123-notes', { id: 4 });

    // Pattern that matches keys containing 'notes' followed by a dash and numbers
    const pattern = /notes-\d+$/;
    const result = LocalCache.getByKeyPattern(pattern);

    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        { key: 'case-notes-123', item: { value: { id: 1 }, expiresAfter: expect.any(Number) } },
        { key: 'case-notes-456', item: { value: { id: 2 }, expiresAfter: expect.any(Number) } },
      ]),
    );
  });
});
