import { renderHook, waitFor } from '@testing-library/react';
import { useTrustee } from './useTrustee';
import Api2 from '@/lib/models/api2';
import MockData from '@common/cams/test-utilities/mock-data';
import * as TrusteesModule from '@common/cams/trustees';

describe('useTrustee', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test.each([
    ['undefined', undefined],
    ['null', null],
  ])('returns null trustee and false loading when trusteeId is %s', (_, trusteeId) => {
    const { result } = renderHook(() => useTrustee(trusteeId as never));

    expect(result.current.trustee).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  test('fetches and returns trustee data when trusteeId is provided', async () => {
    const trustee = MockData.getTrustee();
    vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: trustee });

    const { result } = renderHook(() => useTrustee(trustee.id));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.trustee).toEqual(trustee);
    expect(Api2.getTrustee).toHaveBeenCalledWith(trustee.id);
  });

  test('runs the fetched trustee through sortTrusteePhoneNumbers before storing it', async () => {
    // Sort-order correctness is sortTrusteePhoneNumbers's own contract, covered
    // by common/src/cams/trustees.test.ts. This only confirms the hook wires
    // the fetched trustee through it before storing it in state, matching
    // TrusteeDetailScreen's fetch path.
    const trustee = MockData.getTrustee();
    const sortSpy = vi.spyOn(TrusteesModule, 'sortTrusteePhoneNumbers');
    vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: trustee });

    const { result } = renderHook(() => useTrustee(trustee.id));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(sortSpy).toHaveBeenCalledWith(trustee);
  });

  test('sets trustee to null and stops loading on API error', async () => {
    vi.spyOn(Api2, 'getTrustee').mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useTrustee('trustee-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.trustee).toBeNull();
  });

  test('cancels in-flight request when component unmounts', async () => {
    const trustee = MockData.getTrustee();
    let resolveRequest!: (value: { data: typeof trustee }) => void;
    vi.spyOn(Api2, 'getTrustee').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useTrustee(trustee.id));

    expect(result.current.loading).toBe(true);

    unmount();

    resolveRequest({ data: trustee });

    expect(result.current.trustee).toBeNull();
  });

  test('resets state and re-fetches when trusteeId changes', async () => {
    const trustee1 = MockData.getTrustee();
    const trustee2 = MockData.getTrustee();
    const getTrusteeSpy = vi
      .spyOn(Api2, 'getTrustee')
      .mockResolvedValueOnce({ data: trustee1 })
      .mockResolvedValueOnce({ data: trustee2 });

    const { result, rerender } = renderHook(({ id }) => useTrustee(id), {
      initialProps: { id: trustee1.id },
    });

    await waitFor(() => {
      expect(result.current.trustee).toEqual(trustee1);
    });

    rerender({ id: trustee2.id });

    await waitFor(() => {
      expect(result.current.trustee).toEqual(trustee2);
    });

    expect(getTrusteeSpy).toHaveBeenCalledTimes(2);
  });
});
