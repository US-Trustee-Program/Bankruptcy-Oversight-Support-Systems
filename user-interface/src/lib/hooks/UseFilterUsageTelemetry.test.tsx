import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import useFilterUsageTelemetry, { FilterUsageTelemetryOptions } from './UseFilterUsageTelemetry';
import * as UseApplicationInsights from './UseApplicationInsights';

const CHANGED = 'Test Filter Changed';
const CLEARED = 'Test Filter Cleared';

function stringOptions(
  overrides: Partial<FilterUsageTelemetryOptions<string>> = {},
): FilterUsageTelemetryOptions<string> {
  return {
    changedEventName: CHANGED,
    clearedEventName: CLEARED,
    resultCount: 0,
    isEmpty: (v) => v === '',
    debounceMs: 500,
    ...overrides,
  };
}

describe('useFilterUsageTelemetry', () => {
  let trackEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    trackEvent = vi.fn();
    vi.spyOn(UseApplicationInsights, 'getAppInsights').mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reactPlugin: {} as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      appInsights: { trackEvent } as any,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('fires Changed with resultCount after the debounce delay when value settles to non-empty', () => {
    const { rerender } = renderHook(
      ({ value, options }) => useFilterUsageTelemetry(value, options),
      { initialProps: { value: '', options: stringOptions({ resultCount: 0 }) } },
    );

    rerender({ value: 'abc', options: stringOptions({ resultCount: 7 }) });

    expect(trackEvent).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(500));

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith({ name: CHANGED }, { resultCount: 7 });
  });

  test('fires Cleared with no properties when settled value transitions from non-empty to empty', () => {
    const { rerender } = renderHook(
      ({ value, options }) => useFilterUsageTelemetry(value, options),
      { initialProps: { value: '', options: stringOptions() } },
    );

    rerender({ value: 'abc', options: stringOptions({ resultCount: 3 }) });
    act(() => vi.advanceTimersByTime(500));
    trackEvent.mockClear();

    rerender({ value: '', options: stringOptions({ resultCount: 12 }) });
    act(() => vi.advanceTimersByTime(500));

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith({ name: CLEARED });
  });

  test('fires nothing on initial mount even when the starting value is non-empty', () => {
    // lastReportedRef is initialized to the initial value, so on mount the hook sees
    // no transition — isEqual(value, lastReportedRef.current) is true and no event fires.
    renderHook(({ value, options }) => useFilterUsageTelemetry(value, options), {
      initialProps: { value: 'pre-filled', options: stringOptions({ resultCount: 5 }) },
    });

    act(() => vi.advanceTimersByTime(500));

    expect(trackEvent).not.toHaveBeenCalled();
  });

  test('fires nothing on initial mount when the starting value is already empty', () => {
    renderHook(({ value, options }) => useFilterUsageTelemetry(value, options), {
      initialProps: { value: '', options: stringOptions() },
    });

    act(() => vi.advanceTimersByTime(500));

    expect(trackEvent).not.toHaveBeenCalled();
  });

  test('fires exactly one Changed for the final value when several changes occur within the debounce window', () => {
    const { rerender } = renderHook(
      ({ value, options }) => useFilterUsageTelemetry(value, options),
      { initialProps: { value: '', options: stringOptions({ resultCount: 0 }) } },
    );

    rerender({ value: 'a', options: stringOptions({ resultCount: 1 }) });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: 'ab', options: stringOptions({ resultCount: 2 }) });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: 'abc', options: stringOptions({ resultCount: 5 }) });

    act(() => vi.advanceTimersByTime(500));

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith({ name: CHANGED }, { resultCount: 5 });
  });

  test('uses the resultCount from the latest render when it changes while a debounce is pending', () => {
    const { rerender } = renderHook(
      ({ value, options }) => useFilterUsageTelemetry(value, options),
      { initialProps: { value: '', options: stringOptions({ resultCount: 0 }) } },
    );

    rerender({ value: 'abc', options: stringOptions({ resultCount: 3 }) });
    act(() => vi.advanceTimersByTime(200));

    // resultCount changes (e.g. another filter updated the count) while debounce is still pending
    rerender({ value: 'abc', options: stringOptions({ resultCount: 7 }) });

    act(() => vi.advanceTimersByTime(500));

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith({ name: CHANGED }, { resultCount: 7 });
  });

  test('fires immediately and synchronously when debounceMs is omitted', () => {
    const immediateOptions = (
      overrides: Partial<FilterUsageTelemetryOptions<string>> = {},
    ): FilterUsageTelemetryOptions<string> =>
      stringOptions({ debounceMs: undefined, ...overrides });

    const { rerender } = renderHook(
      ({ value, options }) => useFilterUsageTelemetry(value, options),
      { initialProps: { value: '', options: immediateOptions({ resultCount: 0 }) } },
    );

    rerender({ value: 'x', options: immediateOptions({ resultCount: 4 }) });

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith({ name: CHANGED }, { resultCount: 4 });
  });

  test('works with a nullable numeric value and a null isEmpty predicate', () => {
    const numberOptions = (
      overrides: Partial<FilterUsageTelemetryOptions<number | null>> = {},
    ): FilterUsageTelemetryOptions<number | null> => ({
      changedEventName: CHANGED,
      clearedEventName: CLEARED,
      resultCount: 0,
      isEmpty: (v) => v === null,
      debounceMs: 500,
      ...overrides,
    });

    const { rerender } = renderHook(
      ({
        value,
        options,
      }: {
        value: number | null;
        options: FilterUsageTelemetryOptions<number | null>;
      }) => useFilterUsageTelemetry(value, options),
      { initialProps: { value: null as number | null, options: numberOptions() } },
    );

    rerender({ value: 42, options: numberOptions({ resultCount: 1 }) });
    act(() => vi.advanceTimersByTime(500));

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith({ name: CHANGED }, { resultCount: 1 });
  });

  test('never includes the raw value in any trackEvent call', () => {
    const { rerender } = renderHook(
      ({ value, options }) => useFilterUsageTelemetry(value, options),
      { initialProps: { value: '', options: stringOptions() } },
    );

    const rawValue = 'sensitive-debtor-name';
    rerender({ value: rawValue, options: stringOptions({ resultCount: 2 }) });
    act(() => vi.advanceTimersByTime(500));
    rerender({ value: '', options: stringOptions({ resultCount: 9 }) });
    act(() => vi.advanceTimersByTime(500));

    for (const call of trackEvent.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(rawValue);
    }
  });
});
