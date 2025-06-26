import { describe, test, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { StateMachineProvider, useStateMachine } from './StateMachineContext';
import { EditorState, EditorEvent } from './StateMachine';

// Test component that uses the state machine context
function TestComponent() {
  const { currentState, dispatch } = useStateMachine();

  return (
    <div>
      <div data-testid="current-state">{currentState}</div>
      <button data-testid="input-button" onClick={() => dispatch(EditorEvent.INPUT)}>
        Input
      </button>
      <button data-testid="select-button" onClick={() => dispatch(EditorEvent.SELECTION_CHANGE)}>
        Select
      </button>
      <button data-testid="blur-button" onClick={() => dispatch(EditorEvent.BLUR)}>
        Blur
      </button>
    </div>
  );
}

describe('StateMachineContext', () => {
  test('should provide initial idle state', () => {
    render(
      <StateMachineProvider>
        <TestComponent />
      </StateMachineProvider>,
    );

    expect(screen.getByTestId('current-state')).toHaveTextContent(EditorState.IDLE);
  });

  test('should update state when dispatching events', async () => {
    render(
      <StateMachineProvider>
        <TestComponent />
      </StateMachineProvider>,
    );

    const currentStateElement = screen.getByTestId('current-state');
    const inputButton = screen.getByTestId('input-button');

    // Initial state should be idle
    expect(currentStateElement).toHaveTextContent(EditorState.IDLE);

    // Dispatch input event
    act(() => {
      inputButton.click();
    });

    // State should change to typing
    expect(currentStateElement).toHaveTextContent(EditorState.TYPING);
  });

  test('should handle state transitions correctly', async () => {
    render(
      <StateMachineProvider>
        <TestComponent />
      </StateMachineProvider>,
    );

    const currentStateElement = screen.getByTestId('current-state');
    const inputButton = screen.getByTestId('input-button');
    const selectButton = screen.getByTestId('select-button');
    const blurButton = screen.getByTestId('blur-button');

    // Start with idle
    expect(currentStateElement).toHaveTextContent(EditorState.IDLE);

    // Go to typing
    act(() => {
      inputButton.click();
    });
    expect(currentStateElement).toHaveTextContent(EditorState.TYPING);

    // Go to selecting
    act(() => {
      selectButton.click();
    });
    expect(currentStateElement).toHaveTextContent(EditorState.SELECTING);

    // Go back to idle
    act(() => {
      blurButton.click();
    });
    expect(currentStateElement).toHaveTextContent(EditorState.IDLE);
  });

  test('should throw error when useStateMachine is used outside provider', () => {
    // Suppress console.error for this test since we expect an error
    const originalError = console.error;
    console.error = () => {};

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useStateMachine must be used within a StateMachineProvider');

    console.error = originalError;
  });

  test('should provide access to state machine instance', () => {
    function StateMachineAccessTest() {
      const { stateMachine } = useStateMachine();

      return <div data-testid="has-state-machine">{stateMachine ? 'true' : 'false'}</div>;
    }

    render(
      <StateMachineProvider>
        <StateMachineAccessTest />
      </StateMachineProvider>,
    );

    expect(screen.getByTestId('has-state-machine')).toHaveTextContent('true');
  });
});
