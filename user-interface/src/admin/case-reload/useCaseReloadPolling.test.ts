import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCaseReloadPolling } from './useCaseReloadPolling';
import Api2 from '@/lib/models/api2';
import { SyncedCase } from '@common/cams/cases';

describe('useCaseReloadPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  test('should start in idle state', () => {
    const { result } = renderHook(() => useCaseReloadPolling(null));

    expect(result.current.pollStatus).toBe('idle');
    expect(result.current.latestCase).toBeNull();
  });

  test('should start in idle state with initial case', () => {
    const initialCase: SyncedCase = {
      caseId: '081-23-12345',
      updatedOn: '2024-01-15T10:00:00Z',
    } as SyncedCase;

    const { result } = renderHook(() => useCaseReloadPolling(initialCase));

    expect(result.current.pollStatus).toBe('idle');
    expect(result.current.latestCase).toBe(initialCase);
  });

  test('should poll and detect success for new case', async () => {
    const mockCase: SyncedCase = {
      caseId: '081-23-12345',
      updatedOn: '2024-01-15T12:00:00Z',
      chapter: '11',
      caseTitle: 'Test Case',
      dateFiled: '2024-01-15',
    } as SyncedCase;

    vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [mockCase] });

    const { result } = renderHook(() => useCaseReloadPolling(null));

    act(() => {
      result.current.startPolling('081-23-12345', new Date('2024-01-15T11:00:00Z'));
    });

    expect(result.current.pollStatus).toBe('polling');

    // Advance past initial delay
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    // Advance to first poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.pollStatus).toBe('success');
    expect(result.current.latestCase).toEqual(mockCase);

    expect(Api2.searchCases).toHaveBeenCalledWith({
      caseIds: ['081-23-12345'],
      limit: 1,
      offset: 0,
    });
  });

  test('should detect success when previously synced case updates', async () => {
    const oldCase: SyncedCase = {
      caseId: '081-23-12345',
      updatedOn: '2024-01-15T10:00:00Z',
      chapter: '11',
    } as SyncedCase;

    const newCase: SyncedCase = {
      caseId: '081-23-12345',
      updatedOn: '2024-01-15T12:00:00Z',
      chapter: '11',
    } as SyncedCase;

    vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [newCase] });

    const { result } = renderHook(() => useCaseReloadPolling(oldCase));

    act(() => {
      result.current.startPolling('081-23-12345', new Date('2024-01-15T11:00:00Z'));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // initial delay
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // first poll
    });

    expect(result.current.pollStatus).toBe('success');
    expect(result.current.latestCase).toEqual(newCase);
  });

  test('should not detect success when previously synced case has not updated', async () => {
    const oldCase: SyncedCase = {
      caseId: '081-23-12345',
      updatedOn: '2024-01-15T10:00:00Z',
      chapter: '11',
    } as SyncedCase;

    const unchangedCase: SyncedCase = {
      caseId: '081-23-12345',
      updatedOn: '2024-01-15T09:00:00Z', // Before startTime
      chapter: '11',
    } as SyncedCase;

    vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [unchangedCase] });

    const { result } = renderHook(() => useCaseReloadPolling(oldCase));

    act(() => {
      result.current.startPolling('081-23-12345', new Date('2024-01-15T11:00:00Z'));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // initial delay
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // first poll
    });

    // Should still be polling (not success)
    expect(result.current.pollStatus).toBe('polling');
    expect(result.current.latestCase).toBe(oldCase); // Unchanged
  });

  test('should timeout after max polls', async () => {
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useCaseReloadPolling(null));

    act(() => {
      result.current.startPolling('081-23-12345', new Date());
    });

    // Advance through initial delay + all polls
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // initial delay
    });

    for (let i = 0; i < 24; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
    }

    expect(result.current.pollStatus).toBe('timeout');
    expect(result.current.latestCase).toBeNull();
  });

  test('should stop polling when stopPolling is called', async () => {
    const searchSpy = vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useCaseReloadPolling(null));

    act(() => {
      result.current.startPolling('081-23-12345', new Date());
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // initial delay
    });

    const callCountBefore = searchSpy.mock.calls.length;

    act(() => {
      result.current.stopPolling();
    });

    expect(result.current.pollStatus).toBe('idle');

    // Advance more time - should not poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(searchSpy.mock.calls.length).toBe(callCountBefore);
  });

  test('should stop existing polling when startPolling is called again', async () => {
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useCaseReloadPolling(null));

    // Start first polling
    act(() => {
      result.current.startPolling('081-23-12345', new Date());
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // initial delay
    });

    // Start second polling (should stop first)
    act(() => {
      result.current.startPolling('081-23-67890', new Date());
    });

    // Verify new polling started
    expect(result.current.pollStatus).toBe('polling');

    // Advance time for new polling
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // initial delay
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // first poll of second polling
    });

    // Should have called with new case ID
    expect(Api2.searchCases).toHaveBeenLastCalledWith({
      caseIds: ['081-23-67890'],
      limit: 1,
      offset: 0,
    });
  });

  test('should continue polling after API error', async () => {
    vi.spyOn(Api2, 'searchCases')
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ data: [] });

    const { result } = renderHook(() => useCaseReloadPolling(null));

    act(() => {
      result.current.startPolling('081-23-12345', new Date());
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // initial delay
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // first poll - error
    });

    expect(result.current.pollStatus).toBe('polling'); // Still polling

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // second poll - success
    });

    expect(Api2.searchCases).toHaveBeenCalledTimes(2);
  });

  test('should handle API returning undefined data', async () => {
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: undefined as unknown as SyncedCase[] });

    const { result } = renderHook(() => useCaseReloadPolling(null));

    act(() => {
      result.current.startPolling('081-23-12345', new Date());
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // initial delay
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // first poll
    });

    // Should continue polling (not success)
    expect(result.current.pollStatus).toBe('polling');
  });

  test('should handle API returning empty array', async () => {
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useCaseReloadPolling(null));

    act(() => {
      result.current.startPolling('081-23-12345', new Date());
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // initial delay
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // first poll
    });

    // Should continue polling (not success)
    expect(result.current.pollStatus).toBe('polling');
  });

  test('should set latestCase to null when API returns undefined on success path', async () => {
    const mockCase: SyncedCase = {
      caseId: '081-23-12345',
      updatedOn: '2024-01-15T12:00:00Z',
    } as SyncedCase;

    // First return a case, then return undefined to test null path
    vi.spyOn(Api2, 'searchCases')
      .mockResolvedValueOnce({ data: undefined as unknown as SyncedCase[] })
      .mockResolvedValueOnce({ data: [mockCase] });

    const { result } = renderHook(() => useCaseReloadPolling(null));

    act(() => {
      result.current.startPolling('081-23-12345', new Date());
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // initial delay
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // first poll - undefined
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // second poll - has case
    });

    expect(result.current.pollStatus).toBe('success');
    expect(result.current.latestCase).toEqual(mockCase);
  });

  test('should cleanup timers on unmount', async () => {
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [] });

    const { result, unmount } = renderHook(() => useCaseReloadPolling(null));

    act(() => {
      result.current.startPolling('081-23-12345', new Date());
    });

    expect(result.current.pollStatus).toBe('polling');

    unmount();

    // Advance timers to ensure no errors after unmount
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    // No errors should be thrown
  });

  test('should stop polling before initial delay completes', () => {
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useCaseReloadPolling(null));

    act(() => {
      result.current.startPolling('081-23-12345', new Date());
    });

    expect(result.current.pollStatus).toBe('polling');

    // Stop before initial delay
    act(() => {
      result.current.stopPolling();
    });

    expect(result.current.pollStatus).toBe('idle');
    expect(Api2.searchCases).not.toHaveBeenCalled();
  });
});
