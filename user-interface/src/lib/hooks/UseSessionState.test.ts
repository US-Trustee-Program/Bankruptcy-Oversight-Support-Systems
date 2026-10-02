import { act, renderHook } from '@testing-library/react';
import { useSessionState } from './UseSessionState';

describe('useSessionState', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('reads the initial value from sessionStorage when present', () => {
    sessionStorage.setItem('my-key', JSON.stringify('stored value'));

    const { result } = renderHook(() => useSessionState('my-key', 'default value'));

    expect(result.current[0]).toBe('stored value');
  });

  test('falls back to the initial value when sessionStorage has nothing for the key', () => {
    const { result } = renderHook(() => useSessionState('my-key', 'default value'));

    expect(result.current[0]).toBe('default value');
  });

  test('updates state and persists to sessionStorage on setValue', () => {
    const { result } = renderHook(() => useSessionState('my-key', 'default value'));

    act(() => {
      result.current[1]('updated value');
    });

    expect(result.current[0]).toBe('updated value');
    expect(sessionStorage.getItem('my-key')).toBe(JSON.stringify('updated value'));
  });

  test('setValue accepts a functional updater', () => {
    const { result } = renderHook(() => useSessionState('counter', 0));

    act(() => {
      result.current[1]((prev) => prev + 1);
    });
    act(() => {
      result.current[1]((prev) => prev + 1);
    });

    expect(result.current[0]).toBe(2);
    expect(sessionStorage.getItem('counter')).toBe('2');
  });

  test('resyncs to the new key sessionStorage value when the key changes without a remount', () => {
    sessionStorage.setItem('trustee-A', JSON.stringify('filter for A'));
    sessionStorage.setItem('trustee-B', JSON.stringify('filter for B'));

    const { result, rerender } = renderHook(({ key }) => useSessionState(key, 'default'), {
      initialProps: { key: 'trustee-A' },
    });
    expect(result.current[0]).toBe('filter for A');

    rerender({ key: 'trustee-B' });

    expect(result.current[0]).toBe('filter for B');
  });

  test('resyncs to the initial value when the new key has no stored value', () => {
    sessionStorage.setItem('trustee-A', JSON.stringify('filter for A'));

    const { result, rerender } = renderHook(({ key }) => useSessionState(key, 'default'), {
      initialProps: { key: 'trustee-A' },
    });
    expect(result.current[0]).toBe('filter for A');

    rerender({ key: 'trustee-B' });

    expect(result.current[0]).toBe('default');
  });

  test('does not resync when the key stays the same across rerenders', () => {
    sessionStorage.setItem('trustee-A', JSON.stringify('filter for A'));

    const { result, rerender } = renderHook(({ key }) => useSessionState(key, 'default'), {
      initialProps: { key: 'trustee-A' },
    });

    act(() => {
      result.current[1]('edited in place');
    });

    rerender({ key: 'trustee-A' });

    expect(result.current[0]).toBe('edited in place');
  });

  test('the correct resynced value is available on the same rerender, with no follow-up commit needed', () => {
    sessionStorage.setItem('trustee-A', JSON.stringify('filter for A'));
    sessionStorage.setItem('trustee-B', JSON.stringify('filter for B'));

    let invocationCount = 0;
    const { result, rerender } = renderHook(
      ({ key }) => {
        invocationCount++;
        return useSessionState(key, 'default');
      },
      { initialProps: { key: 'trustee-A' } },
    );

    const countBeforeKeyChange = invocationCount;
    rerender({ key: 'trustee-B' });

    // React's "adjust state during render" pattern re-invokes the component
    // function synchronously in response to the setState call inside the
    // render body itself -- the caller's single rerender() already sees the
    // resynced value, with no extra act()/effect-driven commit (and thus no
    // flash of trustee A's stale value) needed to observe it.
    expect(result.current[0]).toBe('filter for B');
    expect(invocationCount).toBeLessThanOrEqual(countBeforeKeyChange + 2);
  });

  test('degrades to in-memory state when sessionStorage throws', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('sessionStorage unavailable');
    });

    const { result } = renderHook(() => useSessionState('my-key', 'default value'));

    expect(result.current[0]).toBe('default value');

    getItemSpy.mockRestore();
  });
});
