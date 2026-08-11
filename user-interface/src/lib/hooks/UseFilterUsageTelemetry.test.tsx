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
    isEmpty: (v) => v === '',
    debounceMs: 500,
    ...overrides,
  };
}

describe('useFilterUsageTelemetry', () => {
  let trackEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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

  test('fires Changed with no properties after the debounce delay when value settles to non-empty', () => {
    const { rerender } = renderHook(
      ({ value, options }) => useFilterUsageTelemetry(value, options),
      { initialProps: { value: '', options: stringOptions() } },
    );

    rerender({ value: 'abc', options: stringOptions() });

    expect(trackEvent).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(500));

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith({ name: CHANGED });
  });

  test('fires Cleared with no properties when settled value transitions from non-empty to empty', () => {
    const { rerender } = renderHook(
      ({ value, options }) => useFilterUsageTelemetry(value, options),
      { initialProps: { value: '', options: stringOptions() } },
    );

    rerender({ value: 'abc', options: stringOptions() });
    act(() => vi.advanceTimersByTime(500));
    trackEvent.mockClear();

    rerender({ value: '', options: stringOptions() });
    act(() => vi.advanceTimersByTime(500));

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith({ name: CLEARED });
  });

  test('fires nothing on initial mount even when the starting value is non-empty', () => {
    // lastReportedRef is initialized to the initial value, so on mount the hook sees
    // no transition — isEqual(value, lastReportedRef.current) is true and no event fires.
    renderHook(({ value, options }) => useFilterUsageTelemetry(value, options), {
      initialProps: { value: 'pre-filled', options: stringOptions() },
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
      { initialProps: { value: '', options: stringOptions() } },
    );

    rerender({ value: 'a', options: stringOptions() });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: 'ab', options: stringOptions() });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: 'abc', options: stringOptions() });

    act(() => vi.advanceTimersByTime(500));

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith({ name: CHANGED });
  });

  test('reads changedProperties fresh at evaluation time, not frozen at schedule time', () => {
    const { rerender } = renderHook(
      ({ value, options }) => useFilterUsageTelemetry(value, options),
      {
        initialProps: {
          value: '',
          options: stringOptions({ changedProperties: () => ({ tag: 'first' }) }),
        },
      },
    );

    rerender({
      value: 'abc',
      options: stringOptions({ changedProperties: () => ({ tag: 'first' }) }),
    });
    act(() => vi.advanceTimersByTime(200));

    // changedProperties changes (e.g. some other derived state updated) while debounce is pending
    rerender({
      value: 'abc',
      options: stringOptions({ changedProperties: () => ({ tag: 'second' }) }),
    });

    act(() => vi.advanceTimersByTime(500));

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith({ name: CHANGED }, { tag: 'second' });
  });

  test('fires immediately and synchronously when debounceMs is omitted', () => {
    const immediateOptions = (
      overrides: Partial<FilterUsageTelemetryOptions<string>> = {},
    ): FilterUsageTelemetryOptions<string> =>
      stringOptions({ debounceMs: undefined, ...overrides });

    const { rerender } = renderHook(
      ({ value, options }) => useFilterUsageTelemetry(value, options),
      { initialProps: { value: '', options: immediateOptions() } },
    );

    rerender({ value: 'x', options: immediateOptions() });

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith({ name: CHANGED });
  });

  test('works with a nullable numeric value and a null isEmpty predicate', () => {
    const numberOptions = (
      overrides: Partial<FilterUsageTelemetryOptions<number | null>> = {},
    ): FilterUsageTelemetryOptions<number | null> => ({
      changedEventName: CHANGED,
      clearedEventName: CLEARED,
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

    rerender({ value: 42, options: numberOptions() });
    act(() => vi.advanceTimersByTime(500));

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith({ name: CHANGED });
  });

  test('fires Changed on every reference change when no isEqual is provided, even with identical content', () => {
    const objectOptions = (
      overrides: Partial<FilterUsageTelemetryOptions<{ start?: string; end?: string }>> = {},
    ): FilterUsageTelemetryOptions<{ start?: string; end?: string }> => ({
      changedEventName: CHANGED,
      clearedEventName: CLEARED,
      isEmpty: (v) => !v.start && !v.end,
      ...overrides,
    });

    const { rerender } = renderHook(
      ({
        value,
        options,
      }: {
        value: { start?: string; end?: string };
        options: FilterUsageTelemetryOptions<{ start?: string; end?: string }>;
      }) => useFilterUsageTelemetry(value, options),
      { initialProps: { value: {}, options: objectOptions() } },
    );

    rerender({ value: { start: 'a' }, options: objectOptions() });
    expect(trackEvent).toHaveBeenCalledTimes(1);

    // A new object literal with the exact same content — no isEqual means the default
    // reference-equality (Object.is) check treats this as a genuine change.
    rerender({ value: { start: 'a' }, options: objectOptions() });
    expect(trackEvent).toHaveBeenCalledTimes(2);
  });

  test('isEqual suppresses Changed on a reference-only change with identical object content', () => {
    const objectOptions = (
      overrides: Partial<FilterUsageTelemetryOptions<{ start?: string; end?: string }>> = {},
    ): FilterUsageTelemetryOptions<{ start?: string; end?: string }> => ({
      changedEventName: CHANGED,
      clearedEventName: CLEARED,
      isEmpty: (v) => !v.start && !v.end,
      isEqual: (a, b) => a.start === b.start && a.end === b.end,
      ...overrides,
    });

    const { rerender } = renderHook(
      ({
        value,
        options,
      }: {
        value: { start?: string; end?: string };
        options: FilterUsageTelemetryOptions<{ start?: string; end?: string }>;
      }) => useFilterUsageTelemetry(value, options),
      { initialProps: { value: {}, options: objectOptions() } },
    );

    rerender({ value: { start: 'a' }, options: objectOptions() });
    expect(trackEvent).toHaveBeenCalledTimes(1);

    // A new object literal with the exact same content — isEqual correctly recognizes this
    // as unchanged, so no second Changed event fires.
    rerender({ value: { start: 'a' }, options: objectOptions() });
    expect(trackEvent).toHaveBeenCalledTimes(1);

    // Genuinely different content still fires.
    rerender({ value: { start: 'a', end: 'b' }, options: objectOptions() });
    expect(trackEvent).toHaveBeenCalledTimes(2);
  });

  test('never includes the raw value in any trackEvent call', () => {
    const { rerender } = renderHook(
      ({ value, options }) => useFilterUsageTelemetry(value, options),
      { initialProps: { value: '', options: stringOptions() } },
    );

    const rawValue = 'sensitive-debtor-name';
    rerender({ value: rawValue, options: stringOptions() });
    act(() => vi.advanceTimersByTime(500));
    rerender({ value: '', options: stringOptions() });
    act(() => vi.advanceTimersByTime(500));

    for (const call of trackEvent.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(rawValue);
    }
  });

  test('evaluates a function-form changedEventName with the current value to pick the event name', () => {
    const pickName = (v: string) => (v.length < 4 ? 'Short' : 'Long');

    const { rerender } = renderHook(
      ({ value, options }) => useFilterUsageTelemetry(value, options),
      {
        initialProps: {
          value: '',
          options: stringOptions({ changedEventName: pickName }),
        },
      },
    );

    rerender({ value: 'ab', options: stringOptions({ changedEventName: pickName }) });
    act(() => vi.advanceTimersByTime(500));

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith({ name: 'Short' });

    rerender({ value: 'abcdef', options: stringOptions({ changedEventName: pickName }) });
    act(() => vi.advanceTimersByTime(500));

    expect(trackEvent).toHaveBeenCalledTimes(2);
    expect(trackEvent).toHaveBeenNthCalledWith(2, { name: 'Long' });
  });

  test('never applies changedProperties to Cleared', () => {
    const { rerender } = renderHook(
      ({ value, options }) => useFilterUsageTelemetry(value, options),
      {
        initialProps: {
          value: '',
          options: stringOptions({ changedProperties: () => ({ tag: 'first' }) }),
        },
      },
    );

    rerender({
      value: 'abc',
      options: stringOptions({ changedProperties: () => ({ tag: 'first' }) }),
    });
    act(() => vi.advanceTimersByTime(500));
    trackEvent.mockClear();

    rerender({
      value: '',
      options: stringOptions({ changedProperties: () => ({ tag: 'first' }) }),
    });
    act(() => vi.advanceTimersByTime(500));

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith({ name: CLEARED });
  });

  test('suppressClearRef prevents Cleared from firing while true, and is a live per-evaluation check', () => {
    const suppressClearRef = { current: false };

    const { rerender } = renderHook(
      ({ value, options }) => useFilterUsageTelemetry(value, options),
      {
        initialProps: {
          value: '',
          options: stringOptions({ suppressClearRef }),
        },
      },
    );

    rerender({ value: 'abc', options: stringOptions({ suppressClearRef }) });
    act(() => vi.advanceTimersByTime(500));
    trackEvent.mockClear();

    suppressClearRef.current = true;
    rerender({ value: '', options: stringOptions({ suppressClearRef }) });
    act(() => vi.advanceTimersByTime(500));

    expect(trackEvent).not.toHaveBeenCalled();

    suppressClearRef.current = false;
    rerender({ value: 'def', options: stringOptions({ suppressClearRef }) });
    act(() => vi.advanceTimersByTime(500));
    trackEvent.mockClear();

    rerender({ value: '', options: stringOptions({ suppressClearRef }) });
    act(() => vi.advanceTimersByTime(500));

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith({ name: CLEARED });
  });
});
