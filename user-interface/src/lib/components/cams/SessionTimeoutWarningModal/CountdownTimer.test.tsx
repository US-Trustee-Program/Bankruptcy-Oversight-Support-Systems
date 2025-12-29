import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { CountdownTimer } from './CountdownTimer';

describe('Tests for CountdownTimer component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  test('should display initial time in seconds', () => {
    const timeInMs = 60000; // 60 seconds
    render(<CountdownTimer timeInMs={timeInMs} />);

    const timerSpan = screen.getByTestId('countdown-timer');
    expect(timerSpan.tagName.toLowerCase()).toEqual('span');
    expect(timerSpan.textContent).toEqual('60');
  });

  test('should display time rounded down to seconds', () => {
    const timeInMs = 45500; // 45.5 seconds
    render(<CountdownTimer timeInMs={timeInMs} />);

    const timerSpan = screen.getByTestId('countdown-timer');
    expect(timerSpan.textContent).toEqual('45');
  });

  test('should countdown every second', () => {
    const timeInMs = 10000; // 10 seconds
    render(<CountdownTimer timeInMs={timeInMs} />);

    const timerSpan = screen.getByTestId('countdown-timer');
    expect(timerSpan.textContent).toEqual('10');

    // Advance time by 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(timerSpan.textContent).toEqual('9');

    // Advance time by another 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(timerSpan.textContent).toEqual('6');
  });

  test('should reach zero and stop', () => {
    const timeInMs = 3000; // 3 seconds
    render(<CountdownTimer timeInMs={timeInMs} />);

    const timerSpan = screen.getByTestId('countdown-timer');
    expect(timerSpan.textContent).toEqual('3');

    // Advance to zero
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(timerSpan.textContent).toEqual('0');

    // Advance past zero - should stay at zero
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(timerSpan.textContent).toEqual('0');
  });

  test('should display zero for negative time values', () => {
    const timeInMs = -5000;
    render(<CountdownTimer timeInMs={timeInMs} />);

    const timerSpan = screen.getByTestId('countdown-timer');
    expect(timerSpan.textContent).toEqual('0');
  });

  test('should display zero for zero time value', () => {
    const timeInMs = 0;
    render(<CountdownTimer timeInMs={timeInMs} />);

    const timerSpan = screen.getByTestId('countdown-timer');
    expect(timerSpan.textContent).toEqual('0');
  });

  test('should handle large time values', () => {
    const timeInMs = 600000; // 600 seconds / 10 minutes
    render(<CountdownTimer timeInMs={timeInMs} />);

    const timerSpan = screen.getByTestId('countdown-timer');
    expect(timerSpan.textContent).toEqual('600');
  });

  test('should cleanup timer on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const timeInMs = 10000;
    const { unmount } = render(<CountdownTimer timeInMs={timeInMs} />);

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  test('should restart countdown when timeInMs prop changes', () => {
    const timeInMs = 10000; // 10 seconds
    const { rerender } = render(<CountdownTimer timeInMs={timeInMs} />);

    const timerSpan = screen.getByTestId('countdown-timer');
    expect(timerSpan.textContent).toEqual('10');

    // Advance time by 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(timerSpan.textContent).toEqual('7');

    // Update the prop to a new time
    act(() => {
      rerender(<CountdownTimer timeInMs={20000} />);
    });
    expect(timerSpan.textContent).toEqual('20');
  });
});
