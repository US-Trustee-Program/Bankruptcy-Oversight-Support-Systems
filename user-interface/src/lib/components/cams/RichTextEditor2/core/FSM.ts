import {
  EditorCommand,
  EditorState,
  FSMResult,
  VDOMNode,
  VDOMSelection,
  FormatStateValue,
  VDOMPosition,
} from './types';
import {
  getFormatStateAtCursorPosition,
  insertTextWithFormatting,
  toggleBoldInSelection,
} from './model/VDOMFormatting';
import { deleteContentWithCleanup } from './model/VDOMMutations';
import { ZERO_WIDTH_SPACE } from '../RichTextEditor.constants';

// TODO: Future options for FSM configuration
export type FSMOptions = object;

export class FSM {
  constructor(_options?: FSMOptions) {
    // Future initialization
  }

  // TODO: We probably need to model a discriminated union for the EditorCommand to get the type right here.
  processCommand(command: EditorCommand, currentState: EditorState): FSMResult {
    console.log('FSM.processCommand called with command type:', command.type);

    switch (command.type) {
      case 'SET_SELECTION':
        // TODO: Make sure the payload is typed as VDOMSelection when the command is to set selection. Remove the type cast.
        return this.handleSetSelection(command.payload as VDOMSelection, currentState);

      case 'INSERT_TEXT':
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
    // Use the new insertTextWithFormatting function that respects toggle state
    const result = insertTextWithFormatting(
      currentState.vdom,
      currentState.selection,
      text,
      currentState.formatToggleState,
    );

    return {
      newVDOM: result.newVDOM,
      newSelection: result.newSelection,
      didChange: true,
      isPersistent: true,
      // Note: Toggle state should be reset after text insertion
      // but we'll handle that in the Editor when it receives the FSM result
    };
  }

  private handleBackspace(currentState: EditorState): FSMResult {
    const { selection, vdom } = currentState;

    // If we're at the start of the document, nothing to delete
    if (selection.start.offset === 0) {
      return {
        newVDOM: vdom,
        newSelection: selection,
        didChange: false,
        isPersistent: false,
      };
    }

    // Create a selection that covers the character to delete
    const deleteSelection: VDOMSelection = {
      start: {
        node: selection.start.node,
        offset: selection.start.offset - 1,
      },
      end: selection.start,
      isCollapsed: false,
    };

    // Use VDOMMutations to delete the content
    const result = deleteContentWithCleanup(vdom, deleteSelection);

    return {
      ...result,
      didChange: true,
      isPersistent: true,
    };
  }

  private handleEnterKey(currentState: EditorState): FSMResult {
    const { vdom } = currentState;

    // Create a new paragraph with an empty text node
    const newTextNode: VDOMNode = {
      type: 'text',
      path: [vdom.length, 0],
      content: ZERO_WIDTH_SPACE,
    };

    const newParagraph: VDOMNode = {
      type: 'paragraph',
      path: [vdom.length],
      children: [newTextNode],
    };

    return {
      newVDOM: [...vdom, newParagraph],
      newSelection: {
        start: { node: newTextNode, offset: 0 },
        end: { node: newTextNode, offset: 0 },
        isCollapsed: true,
      },
      didChange: true,
      isPersistent: true,
    };
  }

  private handleMoveCursorLeft(currentState: EditorState): FSMResult {
    const { selection, vdom } = currentState;

    // Already at the start
    if (selection.start.offset === 0) {
      return {
        newVDOM: vdom,
        newSelection: selection,
        didChange: false,
        isPersistent: false,
      };
    }

    // Move cursor left by updating offset
    const newPosition: VDOMPosition = {
      node: selection.start.node,
      offset: selection.start.offset - 1,
    };

    return {
      newVDOM: vdom,
      newSelection: {
        start: newPosition,
        end: newPosition,
        isCollapsed: true,
      },
      didChange: false,
      isPersistent: false,
    };
  }

  private handleMoveCursorRight(currentState: EditorState): FSMResult {
    const { selection, vdom } = currentState;
    const currentNode = selection.start.node;

    // If we're at the end of the current text node
    if (
      currentNode.type === 'text' &&
      currentNode.content &&
      selection.start.offset >= currentNode.content.length
    ) {
      // Try to move to the next text node if available
      const nextTextNode = this.findNextTextNode(currentNode, vdom);
      if (nextTextNode) {
        return {
          newVDOM: vdom,
          newSelection: {
            start: { node: nextTextNode, offset: 0 },
            end: { node: nextTextNode, offset: 0 },
            isCollapsed: true,
          },
          didChange: false,
          isPersistent: false,
        };
      }
      // No next node, stay at current position
      return {
        newVDOM: vdom,
        newSelection: selection,
        didChange: false,
        isPersistent: false,
      };
    }

    // Move within current node
    return {
      newVDOM: vdom,
      newSelection: {
        start: {
          node: currentNode,
          offset: selection.start.offset + 1,
        },
        end: {
          node: currentNode,
          offset: selection.start.offset + 1,
        },
        isCollapsed: true,
      },
      didChange: false,
      isPersistent: false,
    };
  }

  /**
   * Helper method to find the next text node in the VDOM tree
   */
  private findNextTextNode(currentNode: VDOMNode, vdom: VDOMNode[]): VDOMNode | null {
    const allNodes = this.getAllNodes(vdom);
    const currentIndex = allNodes.findIndex((node) => node === currentNode && node.type === 'text');

    if (currentIndex === -1) {
      return null;
    }

    // Find next text node
    for (let i = currentIndex + 1; i < allNodes.length; i++) {
      if (allNodes[i].type === 'text') {
        return allNodes[i];
      }
    }

    return null;
  }

  /**
   * Helper method to get all nodes in the VDOM tree
   */
  private getAllNodes(vdom: VDOMNode[]): VDOMNode[] {
    const nodes: VDOMNode[] = [];

    function traverse(nodeList: VDOMNode[]) {
      for (const node of nodeList) {
        nodes.push(node);
        if (node.children) {
          traverse(node.children);
        }
      }
    }

    traverse(vdom);
    return nodes;
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
    const { selection, formatToggleState } = currentState;

    // For collapsed selections (cursor), we should only update the toggle state
    if (selection.isCollapsed) {
      // Check if there's already a pending toggle state
      const currentToggleState = formatToggleState.bold;

      let newBoldState: FormatStateValue;

      if (currentToggleState !== 'inactive') {
        // If there's already a pending toggle, cancel it (set back to inactive)
        newBoldState = 'inactive';
      } else {
        // If no pending toggle, determine new state based on current cursor position
        const currentBoldState = getFormatStateAtCursorPosition(
          currentState.vdom,
          selection,
          'bold',
        );
        newBoldState = currentBoldState === 'active' ? 'inactive' : 'active';
      }

      const newToggleState = {
        ...currentState.formatToggleState,
        bold: newBoldState,
      };

      // Return with updated toggle state but no VDOM changes
      return {
        newVDOM: currentState.vdom, // No change to VDOM
        newSelection: selection, // No change to selection
        didChange: false, // Content didn't change
        isPersistent: false, // Don't persist just a toggle state change
        formatToggleState: newToggleState, // Update the toggle state
      };
    } else {
      // For range selections, apply formatting immediately using the old function
      const newVDOM = toggleBoldInSelection(currentState.vdom, selection);

      // Check if there was actually a change
      const didChange = JSON.stringify(newVDOM) !== JSON.stringify(currentState.vdom);

      return {
        newVDOM,
        newSelection: selection,
        didChange,
        isPersistent: didChange,
        // No formatToggleState change for range selections
      };
    }
  }
}
