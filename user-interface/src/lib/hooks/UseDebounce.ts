import { useCallback, useEffect, useRef } from 'react';

function useDebounce() {
  const timeoutRef = useRef<number | null>(null);

  const debounce = useCallback((callback: () => void, delay: number) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(callback, delay);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debounce;
}

export default useDebounce;
