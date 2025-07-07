import {
  EditorCommand,
  EditorState,
  FSMResult,
  VDOMNode,
  VDOM_NODE_TYPES,
  VDOMSelection,
} from './types';
import { toggleBoldInSelection } from './model/VDOMFormatting';

// TODO: Future options for FSM configuration
export type FSMOptions = object;

export class FSM {
  constructor(_options?: FSMOptions) {
    // Future initialization
  }

  processCommand(
    command: EditorCommand | { type: 'SET_SELECTION'; payload: VDOMSelection },
    currentState: EditorState,
  ): FSMResult {
    switch (command.type) {
      case 'SET_SELECTION':
        return this.handleSetSelection(command.payload, currentState);

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

      case 'TOGGLE_BOLD':
        return this.handleToggleBold(currentState);

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

    // Use the selection state to determine cursor position instead of internal state
    const cursorPosition = currentState.selection.start.offset;

    const newText = currentText.slice(0, cursorPosition) + text + currentText.slice(cursorPosition);

    // Calculate new cursor position
    const newCursorPosition = cursorPosition + text.length;

    // Try to reuse existing text node if we have one, otherwise create new one
    let textNode: VDOMNode;
    const existingTextNode = currentState.vdom.find((node) => node.type === VDOM_NODE_TYPES.TEXT);

    if (existingTextNode) {
      // Reuse existing text node ID to maintain selection continuity
      textNode = {
        id: existingTextNode.id,
        type: VDOM_NODE_TYPES.TEXT,
        content: newText,
      };
    } else {
      // Create a new text node if none exists
      textNode = {
        id: `text-${Date.now()}-${Math.random()}`,
        type: VDOM_NODE_TYPES.TEXT,
        content: newText,
      };
    }

    const newVDOM = [textNode];

    // Create a new selection at the new cursor position
    const newSelection = {
      start: { offset: newCursorPosition },
      end: { offset: newCursorPosition },
      isCollapsed: true,
    };

    return {
      newVDOM,
      newSelection,
      didChange: true,
      isPersistent: true,
    };
  }

  private handleBackspace(currentState: EditorState): FSMResult {
    // Use the selection state to determine cursor position
    const cursorPosition = currentState.selection.start.offset;

    // Only delete if cursor is not at the beginning
    if (cursorPosition <= 0) {
      return {
        newVDOM: currentState.vdom,
        newSelection: currentState.selection,
        didChange: false,
        isPersistent: false,
      };
    }

    // Get current text and remove character before cursor
    const currentText = this.getTextContent(currentState.vdom);
    const newText = currentText.slice(0, cursorPosition - 1) + currentText.slice(cursorPosition);

    // Calculate new cursor position
    const newCursorPosition = Math.max(0, cursorPosition - 1);

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

    // Create new selection at the updated cursor position
    const newSelection = {
      start: { offset: newCursorPosition },
      end: { offset: newCursorPosition },
      isCollapsed: true,
    };

    return {
      newVDOM,
      newSelection,
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
    // Use the selection state to determine current cursor position
    const currentCursorPosition = currentState.selection.start.offset;

    // Move cursor left by one position, but not below 0
    const newCursorPosition = Math.max(0, currentCursorPosition - 1);

    // Create new selection with updated cursor position
    const newSelection = {
      start: { offset: newCursorPosition },
      end: { offset: newCursorPosition },
      isCollapsed: true,
    };

    return {
      newVDOM: currentState.vdom,
      newSelection,
      didChange: false, // No content change, just cursor movement
      isPersistent: false,
    };
  }

  private handleMoveCursorRight(currentState: EditorState): FSMResult {
    // Use the selection state to determine current cursor position
    const currentCursorPosition = currentState.selection.start.offset;

    // Move cursor right by one position, but not beyond text length
    const textLength = this.getTextContent(currentState.vdom).length;
    const newCursorPosition = Math.min(textLength, currentCursorPosition + 1);

    // Create new selection with updated cursor position
    const newSelection = {
      start: { offset: newCursorPosition },
      end: { offset: newCursorPosition },
      isCollapsed: true,
    };

    return {
      newVDOM: currentState.vdom,
      newSelection,
      didChange: false, // No content change, just cursor movement
      isPersistent: false,
    };
  }

  private handleSetCursorPosition(position: unknown, currentState: EditorState): FSMResult {
    // Set cursor to the specified position
    if (typeof position === 'number') {
      const textLength = this.getTextContent(currentState.vdom).length;
      const newCursorPosition = Math.max(0, Math.min(position, textLength));

      // Create selection object with cursor at specified position
      const newSelection = {
        start: { offset: newCursorPosition },
        end: { offset: newCursorPosition },
        isCollapsed: true,
      };

      return {
        newVDOM: currentState.vdom,
        newSelection,
        didChange: false, // No content change, just cursor movement
        isPersistent: false,
      };
    }

    return {
      newVDOM: currentState.vdom,
      newSelection: currentState.selection,
      didChange: false, // No content change, just cursor movement
      isPersistent: false,
    };
  }

  /**
   * Handle the SET_SELECTION command
   * This is used to directly set the selection state from external sources
   */
  private handleSetSelection(selection: VDOMSelection, currentState: EditorState): FSMResult {
    if (!selection) {
      return {
        newVDOM: currentState.vdom,
        newSelection: currentState.selection,
        didChange: false,
        isPersistent: false,
      };
    }

    return {
      newVDOM: currentState.vdom,
      newSelection: selection,
      didChange: false, // No content change, just selection change
      isPersistent: false,
    };
  }

  /**
   * Handle the TOGGLE_BOLD command
   */
  private handleToggleBold(currentState: EditorState): FSMResult {
    // Use the formatting function to toggle bold
    const newVDOM = toggleBoldInSelection(currentState.vdom, currentState.selection);

    // Check if there was actually a change
    const didChange = JSON.stringify(newVDOM) !== JSON.stringify(currentState.vdom);

    return {
      newVDOM,
      newSelection: currentState.selection, // Preserve selection
      didChange,
      isPersistent: didChange,
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
