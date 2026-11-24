import { renderHook, waitFor } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { CourtDivisionDetails } from '@common/cams/courts';

function makeCourt(overrides: Partial<CourtDivisionDetails> = {}): CourtDivisionDetails {
  return {
    officeName: '',
    officeCode: '',
    courtId: '081',
    courtName: 'Southern District of New York',
    courtDivisionCode: '1',
    courtDivisionName: 'Foley Square',
    groupDesignator: '',
    regionId: '',
    regionName: '',
    ...overrides,
  };
}

/**
 * useCourts caches its fetch at module scope (shared across every component on the page), so
 * each test needs a fresh module instance - and a freshly re-imported Api2 to spy on, since
 * vi.resetModules() clears both from vitest's module registry together.
 */
async function loadHook() {
  vi.resetModules();
  const Api2 = (await import('@/lib/models/api2')).default;
  const useCourts = (await import('./UseCourts')).default;
  return { Api2, useCourts };
}

describe('useCourts', () => {
  test('fetches and returns courts data', async () => {
    const courts = [makeCourt()];
    const { Api2, useCourts } = await loadHook();
    const getCourtsSpy = vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: courts } as never);

    const { result } = renderHook(() => useCourts());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.courts).toEqual(courts);
    expect(result.current.error).toBeNull();
    expect(getCourtsSpy).toHaveBeenCalledTimes(1);
  });

  test('retries once after a failed fetch and recovers', async () => {
    const courts = [makeCourt()];
    const { Api2, useCourts } = await loadHook();
    const getCourtsSpy = vi
      .spyOn(Api2, 'getCourts')
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ data: courts } as never);

    const { result } = renderHook(() => useCourts());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.courts).toEqual(courts);
    expect(result.current.error).toBeNull();
    expect(getCourtsSpy).toHaveBeenCalledTimes(2);
  });

  test('surfaces an error only after both the initial attempt and the retry fail', async () => {
    const error = new Error('network error');
    const { Api2, useCourts } = await loadHook();
    const getCourtsSpy = vi.spyOn(Api2, 'getCourts').mockRejectedValue(error);

    const { result } = renderHook(() => useCourts());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.courts).toEqual([]);
    expect(result.current.error).toBe(error);
    expect(getCourtsSpy).toHaveBeenCalledTimes(2);
  });

  test('shares one fetch and caches the result across multiple hook instances', async () => {
    const courts = [makeCourt()];
    const { Api2, useCourts } = await loadHook();
    const getCourtsSpy = vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: courts } as never);

    const { result: firstResult } = renderHook(() => useCourts());
    const { result: secondResult } = renderHook(() => useCourts());

    await waitFor(() => expect(firstResult.current.loading).toBe(false));
    await waitFor(() => expect(secondResult.current.loading).toBe(false));

    expect(firstResult.current.courts).toEqual(courts);
    expect(secondResult.current.courts).toEqual(courts);
    expect(getCourtsSpy).toHaveBeenCalledTimes(1);
  });
});
