import { act, renderHook } from '@testing-library/react';
import useGroupBlur from './UseGroupBlur';

function buildFocusEvent(currentTarget: Partial<Node>, relatedTarget: Node | null) {
  return {
    currentTarget,
    relatedTarget,
  } as unknown as React.FocusEvent<HTMLElement>;
}

describe('useGroupBlur', () => {
  test('touched is false before any interaction', () => {
    const { result } = renderHook(() => useGroupBlur());
    expect(result.current.touched).toBe(false);
  });

  test('touched stays false while focus remains within the group', () => {
    const { result } = renderHook(() => useGroupBlur());
    const container = { contains: () => true };

    act(() => {
      result.current.handleFocus();
    });
    expect(result.current.touched).toBe(false);

    act(() => {
      result.current.handleBlur(buildFocusEvent(container, {} as Node));
    });
    expect(result.current.touched).toBe(false);
  });

  test('touched becomes true once focus leaves the group', () => {
    const { result } = renderHook(() => useGroupBlur());
    const container = { contains: () => false };

    act(() => {
      result.current.handleFocus();
    });
    act(() => {
      result.current.handleBlur(buildFocusEvent(container, null));
    });

    expect(result.current.touched).toBe(true);
  });

  test('touched resets to false when the group regains focus', () => {
    const { result } = renderHook(() => useGroupBlur());
    const container = { contains: () => false };

    act(() => {
      result.current.handleFocus();
    });
    act(() => {
      result.current.handleBlur(buildFocusEvent(container, null));
    });
    expect(result.current.touched).toBe(true);

    act(() => {
      result.current.handleFocus();
    });
    expect(result.current.touched).toBe(false);
  });
});
