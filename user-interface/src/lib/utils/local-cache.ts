import DateTimeUtils from './datetime';
import getAppConfiguration from '@/configuration/appConfiguration';

export type Cacheable<T = unknown> = {
  expiresAfter: number;
  value: T;
};

const NAMESPACE = 'cams:cache:';
const DEFAULT_TTL = DateTimeUtils.HOUR;
const canCache = !!window.localStorage && !getAppConfiguration().disableLocalCache;

function isCacheEnabled() {
  return canCache;
}

function purge() {
  try {
    if (window.localStorage) {
      const keysToPurge = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);

        if (key && key.startsWith(NAMESPACE)) {
          keysToPurge.push(key);
        }
      }

      keysToPurge.forEach((key) => {
        const cached = window.localStorage.getItem(key);
        if (cached && (JSON.parse(cached) as Cacheable).expiresAfter < Date.now()) {
          window.localStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.error('Purging cache in local storage failed:', error);
  }
}

function get<T>(key: string): Cacheable<T> | null {
  try {
    let value: Cacheable<T> | null = null;
    if (canCache) {
      const json = window.localStorage.getItem(NAMESPACE + key);
      if (json) {
        const cached = JSON.parse(json) as Cacheable<T>;
        if (cached.expiresAfter > Date.now()) {
          value = cached;
        } else {
          window.localStorage.removeItem(NAMESPACE + key);
        }
      }
    }
    return value;
  } catch {
    return null;
  }
}

function getByKeyPattern<T>(pattern: RegExp): Array<{ key: string; item: Cacheable<T> }> {
  const items: Array<{ key: string; item: Cacheable<T> }> = [];

  const regExString = pattern.source.replace('^', `^${NAMESPACE}`);
  const _pattern = new RegExp(regExString, pattern.flags);

  if (!window.localStorage) {
    return items;
  }

  for (let i = 0; i < window.localStorage.length; i++) {
    const fullKey = window.localStorage.key(i);

    if (fullKey && fullKey.startsWith(NAMESPACE)) {
      const key = fullKey.substring(NAMESPACE.length);

      if (_pattern.test(fullKey)) {
        const item = get<T>(key)!;
        if (item) {
          items.push({ key: key, item });
        }
      }
    }
  }

  return items;
}

function set<T>(key: string, value: T, ttlSeconds: number = DEFAULT_TTL): boolean {
  try {
    let success = false;
    if (canCache) {
      const cachable: Cacheable<T> = {
        expiresAfter: Date.now() + ttlSeconds * 1000,
        value,
      };
      window.localStorage.setItem(NAMESPACE + key, JSON.stringify(cachable));
      success = true;
    }
    return success;
  } catch {
    return false;
  }
}

function remove(key: string): boolean {
  let success = false;
  if (canCache) {
    window.localStorage.removeItem(NAMESPACE + key);
    success = true;
  }
  return success;
}

function removeAll() {
  removeNamespace();
}

function removeNamespace(suffix: string = '') {
  const keysToDelete = [];
  if (window.localStorage) {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(NAMESPACE + suffix)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => {
      window.localStorage.removeItem(key);
    });
  }
}

const LocalCache = {
  get,
  getByKeyPattern,
  set,
  remove,
  removeAll,
  removeNamespace,
  isCacheEnabled,
  purge,
};

export default LocalCache;
