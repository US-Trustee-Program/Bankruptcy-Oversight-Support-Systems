import { EditorCommand, EditorState, FSMResult, VDOMNode, VDOM_NODE_TYPES } from './types';

// TODO: Future options for FSM configuration
export type FSMOptions = object;

export class FSM {
  private cursorPosition: number = 0;

  constructor(_options?: FSMOptions) {
    // Future initialization
  }

  processCommand(command: EditorCommand, currentState: EditorState): FSMResult {
    switch (command.type) {
      case 'INSERT_TEXT':
        // TODO: We probably need to model a discriminated union for the EditorCommand to get the type right here.
        // TODO: Make sure the payload is typed as string when the command is to insert text. Remove the type cast.
        return this.handleInsertText(command.payload as string, currentState);

      case 'BACKSPACE':
        return this.handleBackspace(currentState);

      case 'ENTER_KEY':
        return this.handleEnterKey(currentState);

      case 'MOVE_CURSOR_LEFT':
        return this.handleMoveCursorLeft(currentState);

      case 'MOVE_CURSOR_RIGHT':
        return this.handleMoveCursorRight(currentState);

      case 'MOVE_CURSOR_UP':
      case 'MOVE_CURSOR_DOWN':
        // For now, up/down movement is not implemented
        return {
          newVDOM: currentState.vdom,
          newSelection: currentState.selection,
          didChange: false,
          isPersistent: false,
        };

      case 'SET_CURSOR_POSITION':
        return this.handleSetCursorPosition(command.payload, currentState);

      default:
        // For unhandled commands, return current state unchanged
        return {
          newVDOM: currentState.vdom,
          newSelection: currentState.selection,
          didChange: false,
          isPersistent: false,
        };
    }
  }

  private handleInsertText(text: string, currentState: EditorState): FSMResult {
    // Get the current text content and insert at cursor position
    const currentText = this.getTextContent(currentState.vdom);
    const newText =
      currentText.slice(0, this.cursorPosition) + text + currentText.slice(this.cursorPosition);

    // Update cursor position
    this.cursorPosition += text.length;

    // Create a single text node with the new content
    const textNode: VDOMNode = {
      id: `text-${Date.now()}-${Math.random()}`,
      type: VDOM_NODE_TYPES.TEXT,
      content: newText,
    };

    const newVDOM = [textNode];

    return {
      newVDOM,
      newSelection: currentState.selection,
      didChange: true,
      isPersistent: true,
    };
  }

  private handleBackspace(currentState: EditorState): FSMResult {
    // Only delete if cursor is not at the beginning
    if (this.cursorPosition <= 0) {
      return {
        newVDOM: currentState.vdom,
        newSelection: currentState.selection,
        didChange: false,
        isPersistent: false,
      };
    }

    // Get current text and remove character before cursor
    const currentText = this.getTextContent(currentState.vdom);
    const newText =
      currentText.slice(0, this.cursorPosition - 1) + currentText.slice(this.cursorPosition);

    // Update cursor position
    this.cursorPosition = Math.max(0, this.cursorPosition - 1);

    // Create new VDOM with updated text
    const newVDOM = newText
      ? [
          {
            id: `text-${Date.now()}-${Math.random()}`,
            type: VDOM_NODE_TYPES.TEXT,
            content: newText,
          },
        ]
      : [];

    return {
      newVDOM,
      newSelection: currentState.selection,
      didChange: true,
      isPersistent: true,
    };
  }

  private handleEnterKey(currentState: EditorState): FSMResult {
    // Add a line break node
    const brNode: VDOMNode = {
      id: `br-${Date.now()}-${Math.random()}`,
      type: VDOM_NODE_TYPES.BR,
    };

    const newVDOM = [...currentState.vdom, brNode];

    return {
      newVDOM,
      newSelection: currentState.selection,
      didChange: true,
      isPersistent: true,
    };
  }

  private handleMoveCursorLeft(currentState: EditorState): FSMResult {
    // Move cursor left by one position, but not below 0
    this.cursorPosition = Math.max(0, this.cursorPosition - 1);

    return {
      newVDOM: currentState.vdom,
      newSelection: currentState.selection,
      didChange: false, // No content change, just cursor movement
      isPersistent: false,
    };
  }

  private handleMoveCursorRight(currentState: EditorState): FSMResult {
    // Move cursor right by one position, but not beyond text length
    const textLength = this.getTextContent(currentState.vdom).length;
    this.cursorPosition = Math.min(textLength, this.cursorPosition + 1);

    return {
      newVDOM: currentState.vdom,
      newSelection: currentState.selection,
      didChange: false, // No content change, just cursor movement
      isPersistent: false,
    };
  }

  private handleSetCursorPosition(position: unknown, currentState: EditorState): FSMResult {
    // Set cursor to the specified position
    if (typeof position === 'number') {
      const textLength = this.getTextContent(currentState.vdom).length;
      this.cursorPosition = Math.max(0, Math.min(position, textLength));
    }

    return {
      newVDOM: currentState.vdom,
      newSelection: currentState.selection,
      didChange: false, // No content change, just cursor movement
      isPersistent: false,
    };
  }

  public getTextContent(vdom: VDOMNode[]): string {
    // Extract all text content from VDOM nodes
    return vdom
      .filter((node) => node.type === VDOM_NODE_TYPES.TEXT)
      .map((node) => node.content || '')
      .join('');
  }
}
