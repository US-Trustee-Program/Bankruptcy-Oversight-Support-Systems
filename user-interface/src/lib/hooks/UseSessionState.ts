import { useCallback, useRef, useState } from 'react';

function readStoredValue<T>(key: string, initialValue: T): T {
  try {
    const item = window.sessionStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : initialValue;
  } catch {
    return initialValue;
  }
}

export function useSessionState<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => readStoredValue(key, initialValue));

  // A caller whose component isn't remounted when `key` changes (e.g. React
  // Router keeps the same instance across a route param change) would
  // otherwise keep showing the previous key's state. Re-reading here, during
  // render, adjusts state before this render commits -- no extra render, no
  // flash of stale content (see cams-hj3u2).
  const keyRef = useRef(key);
  if (keyRef.current !== key) {
    keyRef.current = key;
    setState(readStoredValue(key, initialValue));
  }

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
        if (next !== prev) {
          try {
            window.sessionStorage.setItem(key, JSON.stringify(next));
          } catch {
            // sessionStorage unavailable — degrade to in-memory state only
          }
        }
        return next;
      });
    },
    [key],
  );

  return [state, setValue];
}
