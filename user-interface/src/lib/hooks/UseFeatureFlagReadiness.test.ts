import { renderHook, act } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import useFeatureFlagReadiness from './UseFeatureFlagReadiness';
import * as LaunchDarkly from 'launchdarkly-react-client-sdk';
import * as featureFlagConfig from '@/configuration/featureFlagConfiguration';

vi.mock('launchdarkly-react-client-sdk');
vi.mock('@/configuration/featureFlagConfiguration');

describe('useFeatureFlagReadiness', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  test('is immediately ready and timed out when LaunchDarkly is not configured', () => {
    vi.mocked(featureFlagConfig.getFeatureFlagConfiguration).mockReturnValue({
      clientId: '',
      useExternalProvider: false,
      useCamelCaseFlagKeys: false,
    });
    vi.mocked(LaunchDarkly.useLDClient).mockReturnValue(undefined);

    const { result } = renderHook(() => useFeatureFlagReadiness());

    expect(result.current).toEqual({ isReady: true, hasTimedOut: true });
  });

  test('stays not ready while LaunchDarkly is configured but the client is not yet available', () => {
    vi.mocked(featureFlagConfig.getFeatureFlagConfiguration).mockReturnValue({
      clientId: 'test-client-id',
      useExternalProvider: true,
      useCamelCaseFlagKeys: false,
    });
    vi.mocked(LaunchDarkly.useLDClient).mockReturnValue(undefined);

    const { result } = renderHook(() => useFeatureFlagReadiness());

    expect(result.current).toEqual({ isReady: false, hasTimedOut: false });
  });

  test('becomes ready once the LD client transitions from undefined to available', async () => {
    const mockWaitForInitialization = vi.fn().mockResolvedValue(undefined);

    vi.mocked(featureFlagConfig.getFeatureFlagConfiguration).mockReturnValue({
      clientId: 'test-client-id',
      useExternalProvider: true,
      useCamelCaseFlagKeys: false,
    });
    vi.mocked(LaunchDarkly.useLDClient).mockReturnValue(undefined);

    const { result, rerender } = renderHook(() => useFeatureFlagReadiness());

    expect(result.current).toEqual({ isReady: false, hasTimedOut: false });

    vi.mocked(LaunchDarkly.useLDClient).mockReturnValue({
      waitForInitialization: mockWaitForInitialization,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    rerender();

    await act(async () => {
      await mockWaitForInitialization.mock.results[0].value;
    });
    expect(result.current.isReady).toBe(true);
  });

  test('becomes ready once initialization succeeds, then times out 500ms later', async () => {
    const mockWaitForInitialization = vi.fn().mockResolvedValue(undefined);

    vi.mocked(featureFlagConfig.getFeatureFlagConfiguration).mockReturnValue({
      clientId: 'test-client-id',
      useExternalProvider: true,
      useCamelCaseFlagKeys: false,
    });
    vi.mocked(LaunchDarkly.useLDClient).mockReturnValue({
      waitForInitialization: mockWaitForInitialization,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result } = renderHook(() => useFeatureFlagReadiness());

    await act(async () => {
      await mockWaitForInitialization.mock.results[0].value;
    });
    expect(result.current.isReady).toBe(true);
    expect(result.current.hasTimedOut).toBe(false);

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current.hasTimedOut).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.hasTimedOut).toBe(true);
  });

  test('does not update state if the component unmounts before initialization resolves', async () => {
    let resolveInit!: () => void;
    const mockWaitForInitialization = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveInit = resolve;
        }),
    );

    vi.mocked(featureFlagConfig.getFeatureFlagConfiguration).mockReturnValue({
      clientId: 'test-client-id',
      useExternalProvider: true,
      useCamelCaseFlagKeys: false,
    });
    vi.mocked(LaunchDarkly.useLDClient).mockReturnValue({
      waitForInitialization: mockWaitForInitialization,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result, unmount } = renderHook(() => useFeatureFlagReadiness());
    expect(result.current).toEqual({ isReady: false, hasTimedOut: false });

    unmount();

    await act(async () => {
      resolveInit();
      await Promise.resolve();
    });

    expect(result.current).toEqual({ isReady: false, hasTimedOut: false });
  });

  test('becomes ready and timed out immediately when initialization fails', async () => {
    const mockWaitForInitialization = vi.fn().mockRejectedValue(new Error('LD init failed'));

    vi.mocked(featureFlagConfig.getFeatureFlagConfiguration).mockReturnValue({
      clientId: 'test-client-id',
      useExternalProvider: true,
      useCamelCaseFlagKeys: false,
    });
    vi.mocked(LaunchDarkly.useLDClient).mockReturnValue({
      waitForInitialization: mockWaitForInitialization,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result } = renderHook(() => useFeatureFlagReadiness());

    await act(async () => {
      await mockWaitForInitialization.mock.results[0].value.catch(() => undefined);
    });
    expect(result.current).toEqual({ isReady: true, hasTimedOut: true });
  });

  test('clears the pending timeout and does not update state after unmount', async () => {
    const mockWaitForInitialization = vi.fn().mockResolvedValue(undefined);

    vi.mocked(featureFlagConfig.getFeatureFlagConfiguration).mockReturnValue({
      clientId: 'test-client-id',
      useExternalProvider: true,
      useCamelCaseFlagKeys: false,
    });
    vi.mocked(LaunchDarkly.useLDClient).mockReturnValue({
      waitForInitialization: mockWaitForInitialization,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { result, unmount } = renderHook(() => useFeatureFlagReadiness());

    await act(async () => {
      await mockWaitForInitialization.mock.results[0].value;
    });
    expect(result.current.isReady).toBe(true);

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.hasTimedOut).toBe(false);
  });
});
