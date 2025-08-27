import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import useDebounce from './UseDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should return a debounce function', () => {
    const { result } = renderHook(() => useDebounce());
    expect(typeof result.current).toBe('function');
  });

  test('should delay callback execution by the specified amount', () => {
    const { result } = renderHook(() => useDebounce());
    const callback = vi.fn();
    const debounce = result.current;

    act(() => {
      debounce(callback, 300);
    });

    // Callback should not be called immediately
    expect(callback).not.toHaveBeenCalled();

    // Advance time by 299ms - callback should still not be called
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(callback).not.toHaveBeenCalled();

    // Advance time by 1ms more (total 300ms) - callback should be called
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('should cancel previous timeout when called multiple times rapidly', () => {
    const { result } = renderHook(() => useDebounce());
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const callback3 = vi.fn();
    const debounce = result.current;

    act(() => {
      debounce(callback1, 300);
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    act(() => {
      debounce(callback2, 300);
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    act(() => {
      debounce(callback3, 300);
    });

    // Advance full delay - only the last callback should be called
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).not.toHaveBeenCalled();
    expect(callback3).toHaveBeenCalledTimes(1);
  });

  test('should work with different delay values', () => {
    const { result } = renderHook(() => useDebounce());
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const debounce = result.current;

    act(() => {
      debounce(callback1, 100);
    });

    act(() => {
      debounce(callback2, 500);
    });

    // Advance by 100ms - callback1 should not be called (it was cancelled)
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).not.toHaveBeenCalled();

    // Advance by 400ms more (total 500ms) - callback2 should be called
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  test('should return the same debounce function on re-renders', () => {
    const { result, rerender } = renderHook(() => useDebounce());
    const initialDebounce = result.current;

    rerender();
    const afterRerenderDebounce = result.current;

    expect(initialDebounce).toBe(afterRerenderDebounce);
  });

  test('should cleanup timeout on unmount', () => {
    const { result, unmount } = renderHook(() => useDebounce());
    const callback = vi.fn();
    const debounce = result.current;

    act(() => {
      debounce(callback, 300);
    });

    // Unmount the component before timeout completes
    unmount();

    // Advance time past the delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Callback should not be called because component was unmounted
    expect(callback).not.toHaveBeenCalled();
  });

  test('should handle multiple callbacks with the same delay', () => {
    const { result } = renderHook(() => useDebounce());
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const callback3 = vi.fn();
    const debounce = result.current;

    act(() => {
      debounce(callback1, 200);
    });

    act(() => {
      vi.advanceTimersByTime(50);
    });

    act(() => {
      debounce(callback2, 200);
    });

    act(() => {
      vi.advanceTimersByTime(50);
    });

    act(() => {
      debounce(callback3, 200);
    });

    // Advance full delay - only the last callback should execute
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).not.toHaveBeenCalled();
    expect(callback3).toHaveBeenCalledTimes(1);
  });

  test('should handle zero delay', () => {
    const { result } = renderHook(() => useDebounce());
    const callback = vi.fn();
    const debounce = result.current;

    act(() => {
      debounce(callback, 0);
    });

    // With zero delay, callback should be called on next tick
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('should allow callback to be called after timeout completes and new debounce is set', () => {
    const { result } = renderHook(() => useDebounce());
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const debounce = result.current;

    // First debounced call
    act(() => {
      debounce(callback1, 300);
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(callback1).toHaveBeenCalledTimes(1);

    // Second debounced call after first completed
    act(() => {
      debounce(callback2, 300);
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
  });
});
