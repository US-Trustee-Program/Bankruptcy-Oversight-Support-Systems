import { EditorCommand, EditorState, FSMResult, VDOMNode, VDOM_NODE_TYPES } from './types';

// TODO: Future options for FSM configuration
export type FSMOptions = object;

export class FSM {
  constructor(_options?: FSMOptions) {
    // Future initialization
  }

  processCommand(command: EditorCommand, currentState: EditorState): FSMResult {
    switch (command.type) {
      case 'INSERT_TEXT':
        return this.handleInsertText(command.payload, currentState);

      case 'BACKSPACE':
        return this.handleBackspace(currentState);

      case 'ENTER_KEY':
        return this.handleEnterKey(currentState);

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
    // For now, create a simple text node and add it to VDOM
    // This is a minimal implementation to maintain current functionality
    const textNode: VDOMNode = {
      id: `text-${Date.now()}-${Math.random()}`,
      type: VDOM_NODE_TYPES.TEXT,
      content: text,
    };

    const newVDOM = [...currentState.vdom, textNode];

    return {
      newVDOM,
      newSelection: currentState.selection, // Keep current selection for now
      didChange: true,
      isPersistent: true,
    };
  }

  private handleBackspace(currentState: EditorState): FSMResult {
    // Remove the last text node if it exists
    const newVDOM = [...currentState.vdom];
    if (newVDOM.length > 0) {
      const lastNode = newVDOM[newVDOM.length - 1];
      if (lastNode.type === VDOM_NODE_TYPES.TEXT && lastNode.content) {
        if (lastNode.content.length > 1) {
          // Remove last character from the text node
          lastNode.content = lastNode.content.slice(0, -1);
        } else {
          // Remove the entire text node if it only has one character
          newVDOM.pop();
        }
      }
    }

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
}
