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
    rerender(<CountdownTimer timeInMs={20000} />);
    expect(timerSpan.textContent).toEqual('20');
  });

  test('should stop countdown when running is false', () => {
    const timeInMs = 10000; // 10 seconds
    const { rerender } = render(<CountdownTimer timeInMs={timeInMs} running={true} />);

    const timerSpan = screen.getByTestId('countdown-timer');
    expect(timerSpan.textContent).toEqual('10');

    // Advance time by 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(timerSpan.textContent).toEqual('8');

    // Stop the timer - should reset to 10
    rerender(<CountdownTimer timeInMs={timeInMs} running={false} />);
    expect(timerSpan.textContent).toEqual('10');

    // Advance time - timer should NOT change (stays at reset value)
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(timerSpan.textContent).toEqual('10');
  });

  test('should not start countdown when initially running is false', () => {
    const timeInMs = 10000; // 10 seconds
    render(<CountdownTimer timeInMs={timeInMs} running={false} />);

    const timerSpan = screen.getByTestId('countdown-timer');
    expect(timerSpan.textContent).toEqual('10');

    // Advance time - timer should NOT change
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(timerSpan.textContent).toEqual('10');
  });

  test('should reset and stop when modal closes and restart when modal opens', () => {
    const timeInMs = 10000; // 10 seconds
    const { rerender } = render(<CountdownTimer timeInMs={timeInMs} running={true} />);

    const timerSpan = screen.getByTestId('countdown-timer');
    expect(timerSpan.textContent).toEqual('10');

    // Countdown for 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(timerSpan.textContent).toEqual('7');

    // Modal closes - timer resets to 10 immediately
    rerender(<CountdownTimer timeInMs={timeInMs} running={false} />);
    expect(timerSpan.textContent).toEqual('10');

    // Timer should stay at 10 (not count down)
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(timerSpan.textContent).toEqual('10');

    // Modal opens again with new time - starts from new initial value
    rerender(<CountdownTimer timeInMs={15000} running={true} />);
    expect(timerSpan.textContent).toEqual('15');

    // Verify it counts down again
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(timerSpan.textContent).toEqual('13');
  });

  test('should default to running when running prop is not provided', () => {
    const timeInMs = 10000; // 10 seconds
    render(<CountdownTimer timeInMs={timeInMs} />);

    const timerSpan = screen.getByTestId('countdown-timer');
    expect(timerSpan.textContent).toEqual('10');

    // Timer should count down by default
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(timerSpan.textContent).toEqual('8');
  });

  test('should reset to initial value when modal closes and reopens with same timeInMs', () => {
    const timeInMs = 60000; // 60 seconds
    const { rerender } = render(<CountdownTimer timeInMs={timeInMs} running={true} />);

    const timerSpan = screen.getByTestId('countdown-timer');
    expect(timerSpan.textContent).toEqual('60');

    // Countdown for 15 seconds
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(timerSpan.textContent).toEqual('45');

    // Modal closes - timer resets to 60 immediately
    rerender(<CountdownTimer timeInMs={timeInMs} running={false} />);
    expect(timerSpan.textContent).toEqual('60');

    // Modal opens again with SAME timeInMs - still at 60
    rerender(<CountdownTimer timeInMs={timeInMs} running={true} />);
    expect(timerSpan.textContent).toEqual('60');

    // Verify it counts down again from 60
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(timerSpan.textContent).toEqual('57');
  });
});
