import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTrustee } from './useTrustee';
import Api2 from '@/lib/models/api2';
import MockData from '@common/cams/test-utilities/mock-data';

describe('useTrustee', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('should return null trustee and not loading when no trusteeId is provided', () => {
    const { result } = renderHook(() => useTrustee(null));

    expect(result.current.trustee).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  test('should set trustee on successful API response', async () => {
    const trustee = MockData.getTrustee();
    vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: trustee });

    const { result } = renderHook(() => useTrustee(trustee.trusteeId));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.trustee).toEqual(trustee);
    expect(Api2.getTrustee).toHaveBeenCalledWith(trustee.trusteeId);
  });

  test('should set trustee to null and stop loading on API error', async () => {
    vi.spyOn(Api2, 'getTrustee').mockRejectedValue(new Error('API error'));

    const { result } = renderHook(() => useTrustee('some-trustee-id'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.trustee).toBeNull();
  });

  test('should not update state when component unmounts before successful response', async () => {
    let resolvePromise!: (value: { data: ReturnType<typeof MockData.getTrustee> }) => void;
    const pendingPromise = new Promise<{ data: ReturnType<typeof MockData.getTrustee> }>(
      (resolve) => {
        resolvePromise = resolve;
      },
    );
    vi.spyOn(Api2, 'getTrustee').mockReturnValue(pendingPromise as never);

    const { unmount } = renderHook(() => useTrustee('some-trustee-id'));

    unmount();

    await act(async () => {
      resolvePromise({ data: MockData.getTrustee() });
      await pendingPromise;
    });
  });

  test('should not update state when component unmounts before error response', async () => {
    let rejectPromise!: (error: Error) => void;
    const pendingPromise = new Promise<{ data: ReturnType<typeof MockData.getTrustee> }>(
      (_resolve, reject) => {
        rejectPromise = reject;
      },
    );
    vi.spyOn(Api2, 'getTrustee').mockReturnValue(pendingPromise as never);

    const { unmount } = renderHook(() => useTrustee('some-trustee-id'));

    unmount();

    await act(async () => {
      rejectPromise(new Error('API error'));
      await pendingPromise.catch(() => {});
    });
  });
});
