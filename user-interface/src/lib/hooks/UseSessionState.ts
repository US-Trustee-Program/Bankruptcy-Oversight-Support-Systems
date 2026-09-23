import { useCallback, useState } from 'react';

export function useSessionState<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

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
