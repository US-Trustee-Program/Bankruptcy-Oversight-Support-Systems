import { HOUR } from './datetime';

type Cachable<T = unknown> = {
  expiresAfter: number;
  value: T;
};

const NAMESPACE = 'cams:cache:';
const DEFAULT_TTL = HOUR;
const canCache = !!window.localStorage && import.meta.env['CAMS_DISABLE_LOCAL_CACHE'] !== 'true';

function isCacheEnabled() {
  return canCache;
}

function purge() {
  try {
    if (window.localStorage) {
      Object.keys(window.localStorage).forEach((key) => {
        if (key.startsWith(NAMESPACE)) {
          const cached = JSON.parse(window.localStorage.getItem(key)!) as Cachable;
          if (cached && cached.expiresAfter < Date.now()) {
            window.localStorage.removeItem(key);
          }
        }
      });
    }
  } catch (error) {
    console.error('Purging cache in local storage failed:', error);
  }
}

function get<T>(key: string): T | null {
  try {
    let value: T | null = null;
    if (canCache) {
      const json = window.localStorage.getItem(NAMESPACE + key);
      if (json) {
        const cached = JSON.parse(json) as Cachable<T>;
        if (cached.expiresAfter > Date.now()) {
          value = cached.value;
        } else {
          window.localStorage.removeItem(NAMESPACE + key);
        }
      }
    }
    return value;
  } catch {
    // Fail safely.
    return null;
  }
}

function set<T>(key: string, value: T, ttlSeconds: number = DEFAULT_TTL): boolean {
  try {
    let success = false;
    if (canCache) {
      const cachable: Cachable<T> = {
        expiresAfter: Date.now() + ttlSeconds * 1000,
        value,
      };
      window.localStorage.setItem(NAMESPACE + key, JSON.stringify(cachable));
      success = true;
    }
    return success;
  } catch {
    // Fail safely.
    return false;
  }
}

function remove(key: string): boolean {
  try {
    let success = false;
    if (canCache) {
      window.localStorage.removeItem(NAMESPACE + key);
      success = true;
    }
    return success;
  } catch {
    // Fail safely.
    return false;
  }
}

export const LocalCache = {
  get,
  set,
  remove,
  isCacheEnabled,
  purge,
};

export default LocalCache;
