import { act, renderHook } from '@testing-library/react';
import useDateFieldErrors from './UseDateFieldErrors';

describe('useDateFieldErrors', () => {
  test('hasErrorAmong returns false when no field is registered', () => {
    const { result } = renderHook(() => useDateFieldErrors());
    expect(result.current.hasErrorAmong(['fieldA'])).toBe(false);
  });

  test('registering an error under one field ID is only visible to hasErrorAmong for that ID', () => {
    const { result } = renderHook(() => useDateFieldErrors());

    act(() => {
      result.current.registerFieldError('fieldA', true);
    });

    expect(result.current.hasErrorAmong(['fieldB'])).toBe(false);
    expect(result.current.hasErrorAmong(['fieldA'])).toBe(true);
    expect(result.current.hasErrorAmong(['fieldA', 'fieldB'])).toBe(true);
  });

  test('clearing an error makes hasErrorAmong return false again', () => {
    const { result } = renderHook(() => useDateFieldErrors());

    act(() => {
      result.current.registerFieldError('fieldA', true);
    });
    expect(result.current.hasErrorAmong(['fieldA'])).toBe(true);

    act(() => {
      result.current.registerFieldError('fieldA', false);
    });
    expect(result.current.hasErrorAmong(['fieldA'])).toBe(false);
  });

  test('registerFieldError with unchanged value does not create new state — hasErrorAmong result is stable', () => {
    const { result } = renderHook(() => useDateFieldErrors());

    act(() => {
      result.current.registerFieldError('fieldA', true);
    });

    // Capture hasErrorAmong after the first (state-changing) call.
    // useCallback only re-creates the function when errorsByField changes.
    // A duplicate registration must not change errorsByField, so the reference stays stable.
    const hasErrorAmongAfterFirst = result.current.hasErrorAmong;

    act(() => {
      result.current.registerFieldError('fieldA', true);
    });

    expect(result.current.hasErrorAmong).toBe(hasErrorAmongAfterFirst);
  });
});
