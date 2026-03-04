import { useCallback, useRef } from 'react';

/**
 * Hook that returns a throttled callback.
 *
 * Throttling executes the callback immediately on first call,
 * then ignores subsequent calls during the delay period.
 *
 * Use cases:
 * - Prevent double-clicks on submit buttons
 * - Rate-limit API calls
 * - Limit frequency of scroll/resize handlers
 *
 * @param callback - The function to throttle
 * @param delay - The throttle delay in milliseconds
 * @returns A throttled version of the callback
 *
 * @example
 * const handleSave = useThrottle(async () => {
 *   await saveData();
 * }, 300);
 *
 * <Button onClick={handleSave}>Save</Button>
 */
function useThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number,
): (...args: Parameters<T>) => void {
  const isThrottled = useRef(false);
  const savedCallback = useRef(callback);

  savedCallback.current = callback;

  return useCallback(
    (...args: Parameters<T>) => {
      if (isThrottled.current) {
        return;
      }

      isThrottled.current = true;
      savedCallback.current(...args);

      setTimeout(() => {
        isThrottled.current = false;
      }, delay);
    },
    [delay],
  );
}

export default useThrottle;
