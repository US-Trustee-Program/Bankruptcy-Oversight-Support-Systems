export enum EditorState {
  IDLE = 'idle',
  TYPING = 'typing',
  SELECTING = 'selecting',
  FORMATTING = 'formatting',
}

export enum EditorEvent {
  INPUT = 'input',
  SELECTION_CHANGE = 'selection_change',
  BLUR = 'blur',
  FORMAT = 'format',
  FORMAT_COMPLETE = 'format_complete',
  KEYBOARD_SHORTCUT = 'keyboard_shortcut',
}

type StateChangeCallback = (newState: EditorState) => void;

interface StateTransition {
  from: EditorState;
  event: EditorEvent;
  to: EditorState;
}

export class EditorStateMachine {
  private currentState: EditorState = EditorState.IDLE;
  private stateChangeCallbacks: StateChangeCallback[] = [];

  // Define valid state transitions
  private transitions: StateTransition[] = [
    // From IDLE
    { from: EditorState.IDLE, event: EditorEvent.INPUT, to: EditorState.TYPING },
    { from: EditorState.IDLE, event: EditorEvent.SELECTION_CHANGE, to: EditorState.SELECTING },
    { from: EditorState.IDLE, event: EditorEvent.KEYBOARD_SHORTCUT, to: EditorState.FORMATTING },

    // From TYPING
    { from: EditorState.TYPING, event: EditorEvent.BLUR, to: EditorState.IDLE },
    { from: EditorState.TYPING, event: EditorEvent.SELECTION_CHANGE, to: EditorState.SELECTING },
    { from: EditorState.TYPING, event: EditorEvent.KEYBOARD_SHORTCUT, to: EditorState.FORMATTING },

    // From SELECTING
    { from: EditorState.SELECTING, event: EditorEvent.FORMAT, to: EditorState.FORMATTING },
    { from: EditorState.SELECTING, event: EditorEvent.INPUT, to: EditorState.TYPING },
    { from: EditorState.SELECTING, event: EditorEvent.BLUR, to: EditorState.IDLE },
    {
      from: EditorState.SELECTING,
      event: EditorEvent.KEYBOARD_SHORTCUT,
      to: EditorState.FORMATTING,
    },

    // From FORMATTING
    { from: EditorState.FORMATTING, event: EditorEvent.FORMAT_COMPLETE, to: EditorState.SELECTING },
    { from: EditorState.FORMATTING, event: EditorEvent.INPUT, to: EditorState.TYPING },
    { from: EditorState.FORMATTING, event: EditorEvent.BLUR, to: EditorState.IDLE },
  ];

  constructor() {
    this.currentState = EditorState.IDLE;
  }

  getCurrentState(): EditorState {
    return this.currentState;
  }

  dispatch(event: EditorEvent): void {
    const transition = this.transitions.find(
      (t) => t.from === this.currentState && t.event === event,
    );

    if (transition) {
      const previousState = this.currentState;
      this.currentState = transition.to;

      // Only notify if state actually changed
      if (previousState !== this.currentState) {
        this.notifyStateChange(this.currentState);
      }
    }
    // If no valid transition found, stay in current state (no-op)
  }

  onStateChange(callback: StateChangeCallback): void {
    this.stateChangeCallbacks.push(callback);
  }

  reset(): void {
    const previousState = this.currentState;
    this.currentState = EditorState.IDLE;

    if (previousState !== this.currentState) {
      this.notifyStateChange(this.currentState);
    }
  }

  private notifyStateChange(newState: EditorState): void {
    this.stateChangeCallbacks.forEach((callback) => callback(newState));
  }
}
