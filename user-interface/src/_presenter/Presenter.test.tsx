import { describe, expect, vi } from 'vitest';
import { renderHook, act, render, screen } from '@testing-library/react';
import { PresenterWithUseState, usePresenter } from './Presenter';

// TODO: Move this to test utilities.
function mockUseState() {
  return async () => {
    const actual = await vi.importActual<typeof import('react')>('react');
    return {
      ...actual,
      useState: vi.fn((initial: number) => {
        const [state, setState] = actual.useState(initial);
        return [
          state,
          (newState: number | ((prev: number) => number)) => {
            if (typeof newState === 'function') {
              setState((prev: number) => newState(prev));
            } else {
              setState(newState);
            }
          },
        ];
      }),
    };
  };
}

vi.mock('react', mockUseState());

describe('usePresenter', () => {
  test('render the component', async () => {
    render(<PresenterWithUseState></PresenterWithUseState>);
    const element = await screen.findByTestId('theCount');
    expect(element).toBeInTheDocument();
    expect(element).toHaveTextContent('0');
  });

  test('should initialize with default count of 0 when no initial state provided', () => {
    const { result } = renderHook(() => usePresenter({}));
    expect(result.current.state.count).toEqual(0);
  });

  test('should initialize with provided count', () => {
    const { result } = renderHook(() => usePresenter({ count: 5 }));
    expect(result.current.state.count).toEqual(5);
  });

  test('should increment the count when increment is called', () => {
    const { result } = renderHook(() => usePresenter({ count: 0 }));

    act(() => {
      result.current.actions.increment();
    });

    expect(result.current.state.count).toEqual(1);
  });

  test('should decrement the count when decrement is called', () => {
    const { result } = renderHook(() => usePresenter({ count: 5 }));

    act(() => {
      result.current.actions.decrement();
    });

    expect(result.current.state.count).toEqual(4);
  });

  test('should handle multiple increment and decrement operations', () => {
    const { result } = renderHook(() => usePresenter({ count: 0 }));

    act(() => {
      result.current.actions.increment();
      result.current.actions.increment();
      result.current.actions.decrement();
    });

    expect(result.current.state.count).toEqual(1);
  });
});
