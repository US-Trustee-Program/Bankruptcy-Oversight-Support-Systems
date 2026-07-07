import { act, renderHook } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { useDivisionSelection, ALL_DIVISIONS_VALUE } from './useDivisionSelection';
import { CourtDivisionDetails } from '@common/cams/courts';
import { ComboOption } from '@/lib/components/combobox/ComboBox';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const COURT_ID = '097-';

const MOCK_COURTS: CourtDivisionDetails[] = [
  {
    courtId: '097-',
    courtName: 'District of Alaska',
    courtDivisionCode: '710',
    courtDivisionName: 'Juneau',
    officeCode: '1',
    officeName: 'Juneau',
    groupDesignator: 'AK',
    regionId: '18',
    regionName: 'SEATTLE',
    state: 'AK',
  },
  {
    courtId: '097-',
    courtName: 'District of Alaska',
    courtDivisionCode: '720',
    courtDivisionName: 'Nome',
    officeCode: '2',
    officeName: 'Nome',
    groupDesignator: 'AK',
    regionId: '18',
    regionName: 'SEATTLE',
    state: 'AK',
  },
  {
    courtId: '0981',
    courtName: 'Western District of Washington',
    courtDivisionCode: '812',
    courtDivisionName: 'Seattle',
    officeCode: '2',
    officeName: 'Seattle',
    groupDesignator: 'SE',
    regionId: '18',
    regionName: 'SEATTLE',
    state: 'WA',
  },
];

const DIVISION_CODES_ALASKA = ['710', '720'];

function makeParams(overrides: Partial<Parameters<typeof useDivisionSelection>[0]> = {}) {
  return {
    courtId: COURT_ID,
    allCourts: MOCK_COURTS,
    divisionCodes: [],
    enabled: true,
    onDivisionCodesChange: vi.fn(),
    onAutoSelectAllDivisions: vi.fn(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useDivisionSelection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── divisionOptions (useMemo) ──────────────────────────────────────────────

  describe('divisionOptions', () => {
    test('returns empty array when courtId is empty', () => {
      const { result: hookResult } = renderHook(() =>
        useDivisionSelection(makeParams({ courtId: '' })),
      );
      expect(hookResult.current.divisionOptions).toEqual([]);
    });

    test('returns empty array when allCourts is empty', () => {
      const { result } = renderHook(() => useDivisionSelection(makeParams({ allCourts: [] })));
      expect(result.current.divisionOptions).toEqual([]);
    });

    test('returns All Divisions option plus mapped divisions when courtId and courts are present', () => {
      const { result } = renderHook(() => useDivisionSelection(makeParams()));
      expect(result.current.divisionOptions[0]).toEqual({
        value: ALL_DIVISIONS_VALUE,
        label: 'All Divisions',
      });
      // Alaska has Juneau (710) and Nome (720) — sorted alphabetically
      expect(result.current.divisionOptions).toHaveLength(3);
      const divValues = result.current.divisionOptions.slice(1).map((o) => o.value);
      expect(divValues).toContain('710');
      expect(divValues).toContain('720');
    });
  });

  // ── Auto-select effect ─────────────────────────────────────────────────────

  describe('auto-select effect', () => {
    test('calls onDivisionCodesChange with ALL when enabled and divisionCodes is empty', () => {
      const onDivisionCodesChange = vi.fn();
      const onAutoSelectAllDivisions = vi.fn();

      renderHook(() =>
        useDivisionSelection(
          makeParams({ divisionCodes: [], onDivisionCodesChange, onAutoSelectAllDivisions }),
        ),
      );

      expect(onDivisionCodesChange).toHaveBeenCalledWith([ALL_DIVISIONS_VALUE]);
      expect(onAutoSelectAllDivisions).toHaveBeenCalled();
    });

    test('does NOT call onDivisionCodesChange when divisionCodes already has values', () => {
      const onDivisionCodesChange = vi.fn();
      renderHook(() =>
        useDivisionSelection(makeParams({ divisionCodes: ['710'], onDivisionCodesChange })),
      );
      expect(onDivisionCodesChange).not.toHaveBeenCalled();
    });

    test('does NOT call onDivisionCodesChange when enabled is false', () => {
      const onDivisionCodesChange = vi.fn();
      renderHook(() =>
        useDivisionSelection(
          makeParams({ enabled: false, divisionCodes: [], onDivisionCodesChange }),
        ),
      );
      expect(onDivisionCodesChange).not.toHaveBeenCalled();
    });

    test('does NOT call onDivisionCodesChange when divisionOptions is empty (no courtId)', () => {
      const onDivisionCodesChange = vi.fn();
      renderHook(() =>
        useDivisionSelection(makeParams({ courtId: '', divisionCodes: [], onDivisionCodesChange })),
      );
      expect(onDivisionCodesChange).not.toHaveBeenCalled();
    });

    test('does NOT invoke optional onAutoSelectAllDivisions when it is not provided', () => {
      // No onAutoSelectAllDivisions provided — should not throw
      expect(() => {
        renderHook(() =>
          useDivisionSelection({
            courtId: COURT_ID,
            allCourts: MOCK_COURTS,
            divisionCodes: [],
            enabled: true,
            onDivisionCodesChange: vi.fn(),
            // onAutoSelectAllDivisions intentionally omitted
          }),
        );
      }).not.toThrow();
    });
  });

  // ── cleanup effect ─────────────────────────────────────────────────────────

  describe('cleanup effect', () => {
    test('clears any pending blur timeout on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
      const { result, unmount } = renderHook(() => useDivisionSelection(makeParams()));

      // Trigger a blur to set a pending timeout
      const mockEvent = {
        currentTarget: {
          contains: () => false,
        },
      } as unknown as React.FocusEvent;

      act(() => {
        result.current.handleDivisionBlur(mockEvent);
      });

      // Before advancing timers, unmount — cleanup should call clearTimeout
      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    test('unmounts without error when no blur timeout was set', () => {
      const { unmount } = renderHook(() => useDivisionSelection(makeParams()));
      expect(() => unmount()).not.toThrow();
    });
  });

  // ── getMultiSelections (via divisionSelections) ───────────────────────────

  describe('divisionSelections', () => {
    test('returns undefined when divisionCodes is empty', () => {
      const { result } = renderHook(() => useDivisionSelection(makeParams({ divisionCodes: [] })));
      expect(result.current.divisionSelections).toBeUndefined();
    });

    test('returns undefined when divisionCodes has no matching options', () => {
      const { result } = renderHook(() =>
        useDivisionSelection(makeParams({ divisionCodes: ['NONEXISTENT'] })),
      );
      expect(result.current.divisionSelections).toBeUndefined();
    });

    test('returns matching ComboOptions when divisionCodes has values that match options', () => {
      const { result } = renderHook(() =>
        useDivisionSelection(makeParams({ divisionCodes: ['710'] })),
      );
      expect(result.current.divisionSelections).toBeDefined();
      expect(result.current.divisionSelections![0].value).toBe('710');
    });

    test('returns matching ComboOptions for ALL_DIVISIONS_VALUE', () => {
      const { result } = renderHook(() =>
        useDivisionSelection(makeParams({ divisionCodes: [ALL_DIVISIONS_VALUE] })),
      );
      expect(result.current.divisionSelections).toBeDefined();
      expect(result.current.divisionSelections![0].value).toBe(ALL_DIVISIONS_VALUE);
    });
  });

  // ── handleDivisionSelection ───────────────────────────────────────────────

  describe('handleDivisionSelection', () => {
    test('returns early when selectedValues is empty and divisionCodes includes ALL', () => {
      const onDivisionCodesChange = vi.fn();
      const { result } = renderHook(() =>
        useDivisionSelection(
          makeParams({
            divisionCodes: [ALL_DIVISIONS_VALUE],
            onDivisionCodesChange,
          }),
        ),
      );
      // Clear initial auto-select call
      onDivisionCodesChange.mockClear();

      act(() => {
        result.current.handleDivisionSelection([]);
      });

      // Should have returned early, not called onDivisionCodesChange
      expect(onDivisionCodesChange).not.toHaveBeenCalled();
    });

    test('passes through selection normally when selectedValues is empty but ALL is not in divisionCodes', () => {
      const onDivisionCodesChange = vi.fn();
      const { result } = renderHook(() =>
        useDivisionSelection(
          makeParams({
            divisionCodes: ['710'],
            onDivisionCodesChange,
          }),
        ),
      );
      onDivisionCodesChange.mockClear();

      act(() => {
        result.current.handleDivisionSelection([]);
      });

      expect(onDivisionCodesChange).toHaveBeenCalledWith([]);
    });

    test('when ALL and specific divisions selected and ALL was newly added: calls with [ALL]', () => {
      // divisionCodes has ['710'] (ALL not present), user now selects ALL + 710
      const onDivisionCodesChange = vi.fn();
      const { result } = renderHook(() =>
        useDivisionSelection(
          makeParams({
            divisionCodes: ['710'],
            onDivisionCodesChange,
          }),
        ),
      );
      onDivisionCodesChange.mockClear();

      const selection: ComboOption[] = [
        { value: ALL_DIVISIONS_VALUE, label: 'All Divisions' },
        { value: '710', label: 'Juneau' },
      ];

      act(() => {
        result.current.handleDivisionSelection(selection);
      });

      // ALL was newly added → strip specific divisions
      expect(onDivisionCodesChange).toHaveBeenCalledWith([ALL_DIVISIONS_VALUE]);
    });

    test('when ALL and specific divisions selected and a specific division was newly added: calls without ALL', () => {
      // divisionCodes has [ALL_DIVISIONS_VALUE], user now adds '710'
      const onDivisionCodesChange = vi.fn();
      const { result } = renderHook(() =>
        useDivisionSelection(
          makeParams({
            divisionCodes: [ALL_DIVISIONS_VALUE],
            onDivisionCodesChange,
          }),
        ),
      );
      onDivisionCodesChange.mockClear();

      const selection: ComboOption[] = [
        { value: ALL_DIVISIONS_VALUE, label: 'All Divisions' },
        { value: '710', label: 'Juneau' },
      ];

      act(() => {
        result.current.handleDivisionSelection(selection);
      });

      // '710' was newly added (not in previous divisionCodes) → remove ALL
      expect(onDivisionCodesChange).toHaveBeenCalledWith(['710']);
    });

    test('calls onDivisionCodesChange with selectedValues when no mixed state', () => {
      const onDivisionCodesChange = vi.fn();
      const { result } = renderHook(() =>
        useDivisionSelection(
          makeParams({
            divisionCodes: [],
            onDivisionCodesChange,
          }),
        ),
      );
      onDivisionCodesChange.mockClear();

      const selection: ComboOption[] = [{ value: '710', label: 'Juneau' }];

      act(() => {
        result.current.handleDivisionSelection(selection);
      });

      expect(onDivisionCodesChange).toHaveBeenCalledWith(['710']);
    });
  });

  // ── handlePillRemoval ─────────────────────────────────────────────────────

  describe('handlePillRemoval', () => {
    test('calls onDivisionCodesChange with remaining codes when pills remain', () => {
      const onDivisionCodesChange = vi.fn();
      const { result } = renderHook(() =>
        useDivisionSelection(makeParams({ onDivisionCodesChange })),
      );
      onDivisionCodesChange.mockClear();

      const remaining: ComboOption[] = [{ value: '710', label: 'Juneau' }];

      act(() => {
        result.current.handlePillRemoval(remaining);
      });

      expect(onDivisionCodesChange).toHaveBeenCalledWith(['710']);
    });

    test('falls back to [ALL_DIVISIONS_VALUE] when all pills are removed', () => {
      const onDivisionCodesChange = vi.fn();
      const { result } = renderHook(() =>
        useDivisionSelection(makeParams({ onDivisionCodesChange })),
      );
      onDivisionCodesChange.mockClear();

      act(() => {
        result.current.handlePillRemoval([]);
      });

      expect(onDivisionCodesChange).toHaveBeenCalledWith([ALL_DIVISIONS_VALUE]);
    });
  });

  // ── handleDivisionBlur ────────────────────────────────────────────────────

  describe('handleDivisionBlur', () => {
    function makeBlurEvent(containsActiveElement: boolean): React.FocusEvent {
      return {
        currentTarget: {
          contains: () => containsActiveElement,
        },
      } as unknown as React.FocusEvent;
    }

    test('does nothing while focus is still within the component', () => {
      const onDivisionCodesChange = vi.fn();
      const { result } = renderHook(() =>
        useDivisionSelection(
          makeParams({ divisionCodes: DIVISION_CODES_ALASKA, onDivisionCodesChange }),
        ),
      );
      onDivisionCodesChange.mockClear();

      act(() => {
        result.current.handleDivisionBlur(makeBlurEvent(true));
        vi.runAllTimers();
      });

      expect(onDivisionCodesChange).not.toHaveBeenCalled();
    });

    test('returns early in timeout when courtId is empty', () => {
      const onDivisionCodesChange = vi.fn();
      const { result } = renderHook(() =>
        useDivisionSelection(
          makeParams({ courtId: '', divisionCodes: ['710'], onDivisionCodesChange }),
        ),
      );
      onDivisionCodesChange.mockClear();

      act(() => {
        result.current.handleDivisionBlur(makeBlurEvent(false));
        vi.runAllTimers();
      });

      expect(onDivisionCodesChange).not.toHaveBeenCalled();
    });

    test('returns early in timeout when allCourts is empty', () => {
      const onDivisionCodesChange = vi.fn();
      const { result } = renderHook(() =>
        useDivisionSelection(
          makeParams({ allCourts: [], divisionCodes: ['710'], onDivisionCodesChange }),
        ),
      );
      onDivisionCodesChange.mockClear();

      act(() => {
        result.current.handleDivisionBlur(makeBlurEvent(false));
        vi.runAllTimers();
      });

      expect(onDivisionCodesChange).not.toHaveBeenCalled();
    });

    test('consolidates to [ALL] when all individual divisions for the district are selected', () => {
      // Alaska (097-) has exactly 2 divisions: 710 and 720
      const onDivisionCodesChange = vi.fn();
      const { result } = renderHook(() =>
        useDivisionSelection(
          makeParams({
            divisionCodes: ['710', '720'],
            onDivisionCodesChange,
          }),
        ),
      );
      onDivisionCodesChange.mockClear();

      act(() => {
        result.current.handleDivisionBlur(makeBlurEvent(false));
        vi.runAllTimers();
      });

      expect(onDivisionCodesChange).toHaveBeenCalledWith([ALL_DIVISIONS_VALUE]);
    });

    test('does NOT consolidate when only some divisions are selected', () => {
      const onDivisionCodesChange = vi.fn();
      const { result } = renderHook(() =>
        useDivisionSelection(
          makeParams({
            divisionCodes: ['710'], // only one of two
            onDivisionCodesChange,
          }),
        ),
      );
      onDivisionCodesChange.mockClear();

      act(() => {
        result.current.handleDivisionBlur(makeBlurEvent(false));
        vi.runAllTimers();
      });

      expect(onDivisionCodesChange).not.toHaveBeenCalled();
    });

    test('does NOT consolidate when ALL_DIVISIONS_VALUE is already in divisionCodes', () => {
      const onDivisionCodesChange = vi.fn();
      const { result } = renderHook(() =>
        useDivisionSelection(
          makeParams({
            divisionCodes: [ALL_DIVISIONS_VALUE, '710', '720'],
            onDivisionCodesChange,
          }),
        ),
      );
      onDivisionCodesChange.mockClear();

      act(() => {
        result.current.handleDivisionBlur(makeBlurEvent(false));
        vi.runAllTimers();
      });

      expect(onDivisionCodesChange).not.toHaveBeenCalled();
    });

    test('does NOT consolidate when divisionCodes length is 0', () => {
      const onDivisionCodesChange = vi.fn();
      const { result } = renderHook(() =>
        useDivisionSelection(
          makeParams({
            divisionCodes: [],
            onDivisionCodesChange,
          }),
        ),
      );
      onDivisionCodesChange.mockClear();

      act(() => {
        result.current.handleDivisionBlur(makeBlurEvent(false));
        vi.runAllTimers();
      });

      expect(onDivisionCodesChange).not.toHaveBeenCalled();
    });

    test('does NOT consolidate when selected codes do not match the available divisions', () => {
      // 2 codes, same count as Alaska divisions, but with a wrong code
      const onDivisionCodesChange = vi.fn();
      const { result } = renderHook(() =>
        useDivisionSelection(
          makeParams({
            divisionCodes: ['710', '999'], // 999 is not an Alaska division
            onDivisionCodesChange,
          }),
        ),
      );
      onDivisionCodesChange.mockClear();

      act(() => {
        result.current.handleDivisionBlur(makeBlurEvent(false));
        vi.runAllTimers();
      });

      expect(onDivisionCodesChange).not.toHaveBeenCalled();
    });

    test('cancels previous blur timeout when blur fires again before 100ms', () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
      const onDivisionCodesChange = vi.fn();
      const { result } = renderHook(() =>
        useDivisionSelection(
          makeParams({
            divisionCodes: ['710', '720'],
            onDivisionCodesChange,
          }),
        ),
      );
      onDivisionCodesChange.mockClear();

      act(() => {
        result.current.handleDivisionBlur(makeBlurEvent(false));
      });

      // Fire blur again before timers run
      act(() => {
        result.current.handleDivisionBlur(makeBlurEvent(false));
      });

      // clearTimeout should have been called to cancel the first timeout
      expect(clearTimeoutSpy).toHaveBeenCalled();

      act(() => {
        vi.runAllTimers();
      });

      // Only one consolidation call (from the second blur)
      expect(onDivisionCodesChange).toHaveBeenCalledTimes(1);
    });
  });
});
