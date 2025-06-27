import { describe, test, expect, beforeEach } from 'vitest';
import { EditorStateMachine, EditorState, EditorEvent } from './StateMachine';

describe('EditorStateMachine', () => {
  let stateMachine: EditorStateMachine;

  beforeEach(() => {
    stateMachine = new EditorStateMachine();
  });

  test('should initialize with idle state', () => {
    expect(stateMachine.getCurrentState()).toBe(EditorState.IDLE);
  });

  test('should transition from idle to typing on input event', () => {
    stateMachine.dispatch(EditorEvent.INPUT);
    expect(stateMachine.getCurrentState()).toBe(EditorState.TYPING);
  });

  test('should transition from idle to selecting on selection event', () => {
    stateMachine.dispatch(EditorEvent.SELECTION_CHANGE);
    expect(stateMachine.getCurrentState()).toBe(EditorState.SELECTING);
  });

  test('should transition from typing to idle on blur event', () => {
    stateMachine.dispatch(EditorEvent.INPUT);
    expect(stateMachine.getCurrentState()).toBe(EditorState.TYPING);

    stateMachine.dispatch(EditorEvent.BLUR);
    expect(stateMachine.getCurrentState()).toBe(EditorState.IDLE);
  });

  test('should transition from selecting to formatting on format event', () => {
    stateMachine.dispatch(EditorEvent.SELECTION_CHANGE);
    expect(stateMachine.getCurrentState()).toBe(EditorState.SELECTING);

    stateMachine.dispatch(EditorEvent.FORMAT);
    expect(stateMachine.getCurrentState()).toBe(EditorState.FORMATTING);
  });

  test('should transition from formatting back to selecting after format complete', () => {
    stateMachine.dispatch(EditorEvent.SELECTION_CHANGE);
    stateMachine.dispatch(EditorEvent.FORMAT);
    expect(stateMachine.getCurrentState()).toBe(EditorState.FORMATTING);

    stateMachine.dispatch(EditorEvent.FORMAT_COMPLETE);
    expect(stateMachine.getCurrentState()).toBe(EditorState.SELECTING);
  });

  test('should handle keyboard shortcuts from any state', () => {
    // From idle
    stateMachine.dispatch(EditorEvent.KEYBOARD_SHORTCUT);
    expect(stateMachine.getCurrentState()).toBe(EditorState.FORMATTING);

    // Reset to typing
    stateMachine.dispatch(EditorEvent.FORMAT_COMPLETE);
    stateMachine.dispatch(EditorEvent.INPUT);
    expect(stateMachine.getCurrentState()).toBe(EditorState.TYPING);

    // From typing
    stateMachine.dispatch(EditorEvent.KEYBOARD_SHORTCUT);
    expect(stateMachine.getCurrentState()).toBe(EditorState.FORMATTING);
  });

  test('should stay in current state for invalid transitions', () => {
    // Try to format without selection or shortcut from idle
    stateMachine.dispatch(EditorEvent.FORMAT);
    expect(stateMachine.getCurrentState()).toBe(EditorState.IDLE);
  });

  test('should provide state change callbacks', () => {
    let stateChangeCount = 0;
    let lastState: EditorState | null = null;

    stateMachine.onStateChange((newState) => {
      stateChangeCount++;
      lastState = newState;
    });

    stateMachine.dispatch(EditorEvent.INPUT);
    expect(stateChangeCount).toBe(1);
    expect(lastState).toBe(EditorState.TYPING);

    stateMachine.dispatch(EditorEvent.BLUR);
    expect(stateChangeCount).toBe(2);
    expect(lastState).toBe(EditorState.IDLE);
  });

  test('should reset to idle state', () => {
    stateMachine.dispatch(EditorEvent.INPUT);
    stateMachine.dispatch(EditorEvent.SELECTION_CHANGE);
    expect(stateMachine.getCurrentState()).toBe(EditorState.SELECTING);

    stateMachine.reset();
    expect(stateMachine.getCurrentState()).toBe(EditorState.IDLE);
  });
});
