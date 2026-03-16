import { useState } from 'react';

export function useSessionState<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const storedValue = (() => {
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  })();

  const [state, setState] = useState<T>(storedValue);

  function setValue(value: T) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // sessionStorage unavailable — degrade to in-memory state only
    }
    setState(value);
  }

  return [state, setValue];
}
