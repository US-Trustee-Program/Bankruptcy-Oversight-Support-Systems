import {
  EditorCommand,
  EditorState,
  FSMResult,
  VDOMNode,
  VDOMSelection,
  FormatStateValue,
  VDOMPosition,
} from './types';
import { toggleBold } from './model/VDOMFormatting';
import { deleteContentWithCleanup, insertText } from './model/VDOMMutations';
import { ZERO_WIDTH_SPACE } from '../RichTextEditor.constants';
import { getFormattingAtSelection } from './model/VDOMSelection';

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
    const result = insertText(currentState.vdom, currentState.selection, text);

    return {
      newVDOM: result.newVDOM,
      newSelection: result.newSelection,
      didChange: true,
      isPersistent: true,
    };
  }

  private handleBackspace(currentState: EditorState): FSMResult {
    const { selection, vdom } = currentState;

    // If we have a range selection, delete the selected content
    if (!selection.isCollapsed) {
      const result = deleteContentWithCleanup(vdom, selection);
      return {
        ...result,
        didChange: true,
        isPersistent: true,
      };
    }

    // For collapsed selection, handle single character deletion
    const { start } = selection;

    // If we're at the start of the current text node, check for cross-node navigation
    if (start.offset === 0) {
      // Find the previous text node
      const previousNode = this.findPreviousTextNode(start.node, vdom);

      if (previousNode && previousNode.content) {
        // Delete the last character from the previous node
        const deleteSelection: VDOMSelection = {
          start: {
            node: previousNode,
            offset: previousNode.content.length - 1,
          },
          end: {
            node: previousNode,
            offset: previousNode.content.length,
          },
          isCollapsed: false,
        };

        const result = deleteContentWithCleanup(vdom, deleteSelection);
        return {
          ...result,
          didChange: true,
          isPersistent: true,
        };
      } else {
        // No previous node or it's empty - can't delete anything
        return {
          newVDOM: vdom,
          newSelection: selection,
          didChange: false,
          isPersistent: false,
        };
      }
    }

    // Delete character to the left of cursor within current node
    const deleteSelection: VDOMSelection = {
      start: {
        node: start.node,
        offset: start.offset - 1,
      },
      end: start,
      isCollapsed: false,
    };

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

    // Check if already at the start of current text node
    if (selection.start.offset === 0) {
      // Try to move to the end of the previous text node
      const previousNode = this.findPreviousTextNode(selection.start.node, vdom);

      if (previousNode && previousNode.content) {
        // Move to the end of the previous text node
        const newSelection: VDOMSelection = {
          start: { node: previousNode, offset: previousNode.content.length },
          end: { node: previousNode, offset: previousNode.content.length },
          isCollapsed: true,
        };

        return {
          newVDOM: vdom,
          newSelection,
          didChange: false,
          isPersistent: false,
        };
      } else {
        // No previous text node, stay at current position
        return {
          newVDOM: vdom,
          newSelection: selection,
          didChange: false,
          isPersistent: false,
        };
      }
    }

    // Move cursor left within current node
    const newPosition: VDOMPosition = {
      node: selection.start.node,
      offset: selection.start.offset - 1,
    };

    const newSelection: VDOMSelection = {
      start: newPosition,
      end: newPosition,
      isCollapsed: true,
    };

    return {
      newVDOM: vdom,
      newSelection,
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
      // Try to move to the beginning of the next text node
      const nextNode = this.findNextTextNode(currentNode, vdom);

      if (nextNode) {
        // Move to the beginning of the next text node
        const newSelection: VDOMSelection = {
          start: { node: nextNode, offset: 0 },
          end: { node: nextNode, offset: 0 },
          isCollapsed: true,
        };

        return {
          newVDOM: vdom,
          newSelection,
          didChange: false,
          isPersistent: false,
        };
      } else {
        // No next text node, stay at current position
        return {
          newVDOM: vdom,
          newSelection: selection,
          didChange: false,
          isPersistent: false,
        };
      }
    }

    // Move cursor right within current node
    const newSelection: VDOMSelection = {
      start: {
        node: currentNode,
        offset: selection.start.offset + 1,
      },
      end: {
        node: currentNode,
        offset: selection.start.offset + 1,
      },
      isCollapsed: true,
    };

    return {
      newVDOM: vdom,
      newSelection,
      didChange: false,
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
        // If no pending toggle, determine new state based on current formatting
        const currentFormatting = getFormattingAtSelection(currentState.vdom, selection);
        newBoldState = currentFormatting.bold === 'active' ? 'inactive' : 'active';
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
      // For range selections, apply formatting immediately
      const result = toggleBold(currentState.vdom, selection);

      // Check if there was actually a change
      const didChange = JSON.stringify(result.vdom) !== JSON.stringify(currentState.vdom);

      return {
        newVDOM: result.vdom,
        newSelection: result.selection,
        didChange,
        isPersistent: didChange,
        // No formatToggleState change for range selections
      };
    }
  }

  /**
   * Helper function to get all text nodes in VDOM tree in document order
   */
  private getAllTextNodes(vdom: VDOMNode[]): VDOMNode[] {
    const textNodes: VDOMNode[] = [];

    function traverse(nodes: VDOMNode[]) {
      for (const node of nodes) {
        if (node.type === 'text') {
          textNodes.push(node);
        }
        if (node.children) {
          traverse(node.children);
        }
      }
    }

    traverse(vdom);
    return textNodes;
  }

  /**
   * Helper function to compare two node paths to determine document order
   * Returns: -1 if path1 comes before path2, 0 if equal, 1 if path1 comes after path2
   */
  private comparePaths(path1: number[], path2: number[]): number {
    const minLength = Math.min(path1.length, path2.length);

    for (let i = 0; i < minLength; i++) {
      if (path1[i] < path2[i]) return -1;
      if (path1[i] > path2[i]) return 1;
    }

    // If paths are identical up to the shorter length, the shorter path comes first
    if (path1.length < path2.length) return -1;
    if (path1.length > path2.length) return 1;

    return 0; // Paths are identical
  }

  /**
   * Find the previous text node in document order
   */
  private findPreviousTextNode(currentNode: VDOMNode, vdom: VDOMNode[]): VDOMNode | null {
    const allTextNodes = this.getAllTextNodes(vdom);
    const currentPath = currentNode.path;

    let previousNode: VDOMNode | null = null;

    for (const textNode of allTextNodes) {
      // If this text node comes before the current node
      if (this.comparePaths(textNode.path, currentPath) < 0) {
        // Keep track of the latest previous node (closest to current)
        if (!previousNode || this.comparePaths(textNode.path, previousNode.path) > 0) {
          previousNode = textNode;
        }
      }
    }

    return previousNode;
  }

  /**
   * Find the next text node in document order
   */
  private findNextTextNode(currentNode: VDOMNode, vdom: VDOMNode[]): VDOMNode | null {
    const allTextNodes = this.getAllTextNodes(vdom);
    const currentPath = currentNode.path;

    let nextNode: VDOMNode | null = null;

    for (const textNode of allTextNodes) {
      // If this text node comes after the current node
      if (this.comparePaths(textNode.path, currentPath) > 0) {
        // Keep track of the earliest next node (closest to current)
        if (!nextNode || this.comparePaths(textNode.path, nextNode.path) < 0) {
          nextNode = textNode;
        }
      }
    }

    return nextNode;
  }
}
