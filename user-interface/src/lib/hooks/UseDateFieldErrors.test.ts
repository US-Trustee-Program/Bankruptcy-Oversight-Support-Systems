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

  test('registerFieldError does not trigger a state update when the value is unchanged', () => {
    const { result } = renderHook(() => useDateFieldErrors());
    const registerFieldError = result.current.registerFieldError;

    act(() => {
      registerFieldError('fieldA', true);
    });
    const hasErrorAmongAfterFirst = result.current.hasErrorAmong;

    act(() => {
      registerFieldError('fieldA', true);
    });
    const hasErrorAmongAfterSecond = result.current.hasErrorAmong;

    // hasErrorAmong is memoized on errorsByField, so identity is stable when state didn't change
    expect(hasErrorAmongAfterFirst).toBe(hasErrorAmongAfterSecond);
  });
});
