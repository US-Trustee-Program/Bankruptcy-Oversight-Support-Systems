import {
  EditorCommand,
  EditorState,
  FSMResult,
  VDOMNode,
  VDOM_NODE_TYPES,
  VDOMSelection,
  FormatStateValue,
} from './types';
import {
  getFormatStateAtCursorPosition,
  insertTextWithFormatting,
  toggleBoldInSelection,
} from './model/VDOMFormatting';
import { textContentOffsetToNodeOffset, getTextOffsetInVDOM } from './model/VDOMSelection';
import { deleteContentWithCleanup } from './model/VDOMMutations';

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

  private handleInsertTextFallback(text: string, currentState: EditorState): FSMResult {
    // Original implementation as fallback
    const currentText = this.getTextContent(currentState.vdom);
    const cursorPosition = currentState.selection.start.offset;
    const newText = currentText.slice(0, cursorPosition) + text + currentText.slice(cursorPosition);
    const newCursorPosition = cursorPosition + text.length;

    let textNode: VDOMNode;
    const existingTextNode = currentState.vdom.find((node) => node.type === VDOM_NODE_TYPES.TEXT);

    if (existingTextNode) {
      textNode = {
        id: existingTextNode.id,
        type: VDOM_NODE_TYPES.TEXT,
        content: newText,
      };
    } else {
      textNode = {
        id: `text-${Date.now()}-${Math.random()}`,
        type: VDOM_NODE_TYPES.TEXT,
        content: newText,
      };
    }

    const newVDOM = [textNode];
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
    // Phase 1: Hybrid approach - convert absolute selection to node-based selection,
    // then use VDOMMutations.deleteContent, then convert result back to absolute

    // Step 1: For BACKSPACE, we need to delete the character BEFORE the cursor
    // So we convert the position of the character to delete, not the cursor position
    const cursorPosition = currentState.selection.start.offset;

    // Handle edge case: can't delete if at beginning of document
    if (cursorPosition <= 0) {
      return {
        newVDOM: currentState.vdom,
        newSelection: currentState.selection,
        didChange: false,
        isPersistent: false,
      };
    }

    // Handle malformed selections gracefully by checking bounds
    const textContent = this.getTextContent(currentState.vdom);
    if (cursorPosition > textContent.length) {
      // Out of bounds selection - return original state with no changes
      return {
        newVDOM: currentState.vdom,
        newSelection: {
          start: { offset: textContent.length },
          end: { offset: textContent.length },
          isCollapsed: true,
        },
        didChange: false,
        isPersistent: false,
      };
    }

    // Convert the position of the character to delete (cursor - 1)
    const deletePosition = cursorPosition - 1;
    const nodeStartPos = textContentOffsetToNodeOffset(currentState.vdom, deletePosition);

    // Step 2: Handle conversion failures with fallback
    if (!nodeStartPos) {
      return this.handleBackspaceFallback(currentState);
    }

    // Step 3: Create node-based selection for VDOMMutations
    // For BACKSPACE, we create a range selection that deletes one character
    const nodeBasedSelection: VDOMSelection = {
      start: { nodeId: nodeStartPos.nodeId, offset: nodeStartPos.offset },
      end: { nodeId: nodeStartPos.nodeId, offset: nodeStartPos.offset + 1 },
      isCollapsed: false, // Range selection to delete the character
    };

    // Step 4: Use VDOMMutations.deleteContentWithCleanup for BACKSPACE
    const mutationResult = deleteContentWithCleanup(currentState.vdom, nodeBasedSelection);

    // Step 5: Convert result selection back to absolute positioning
    const absoluteStartOffset = getTextOffsetInVDOM(
      mutationResult.newVDOM,
      mutationResult.newSelection.start.nodeId!,
      mutationResult.newSelection.start.offset,
    );

    const absoluteSelection: VDOMSelection = {
      start: { offset: absoluteStartOffset },
      end: { offset: absoluteStartOffset },
      isCollapsed: true,
    };

    return {
      newVDOM: mutationResult.newVDOM,
      newSelection: absoluteSelection,
      didChange: true,
      isPersistent: true,
    };
  }

  private handleBackspaceFallback(currentState: EditorState): FSMResult {
    // Original implementation as fallback
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

    // Calculate node positions to find the correct cursor position
    const nodePositions = this.calculateNodePositions(currentState.vdom);

    // Check if we're at a formatting boundary
    const newCursorPosition = Math.max(0, currentCursorPosition - 1);

    // Find if the new position is exactly at a node boundary and adjust if needed
    const boundaryNode = nodePositions.find((pos) => pos.start === newCursorPosition);
    if (boundaryNode) {
      // If we're at the boundary between formatted and unformatted text,
      // ensure the cursor is positioned properly on the character
      console.log('Cursor at boundary between nodes:', boundaryNode);
    }

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

    // Calculate node positions to find the correct cursor position
    const nodePositions = this.calculateNodePositions(currentState.vdom);

    // Calculate total text length
    let textLength = 0;
    if (nodePositions.length > 0) {
      const lastNode = nodePositions[nodePositions.length - 1];
      textLength = lastNode.end;
    }

    // Move cursor right by one position, but not beyond text length
    const newCursorPosition = Math.min(textLength, currentCursorPosition + 1);

    // Find if the new position is exactly at a node boundary and adjust if needed
    const boundaryNode = nodePositions.find((pos) => pos.end === newCursorPosition);
    if (boundaryNode) {
      // If we're at the boundary between formatted and unformatted text,
      // ensure the cursor is positioned properly on the character
      console.log('Cursor at boundary between nodes:', boundaryNode);
    }

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
    const selection = currentState.selection;

    // For collapsed selections (cursor), we should only update the toggle state
    // without modifying the VDOM structure
    if (selection.isCollapsed) {
      // Check if there's already a pending toggle state
      const currentToggleState = currentState.formatToggleState.bold;

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

  /**
   * Calculate the positions of each node in the VDOM
   * This helps with mapping cursor positions between different node types
   * with different formatting
   */
  private calculateNodePositions(vdom: VDOMNode[]): Array<{
    node: VDOMNode;
    start: number;
    end: number;
  }> {
    const positions: Array<{
      node: VDOMNode;
      start: number;
      end: number;
    }> = [];

    let currentOffset = 0;

    for (const node of vdom) {
      if (node.type === VDOM_NODE_TYPES.TEXT) {
        const length = node.content?.length || 0;
        positions.push({
          node,
          start: currentOffset,
          end: currentOffset + length,
        });
        currentOffset += length;
      } else if (node.type === 'strong' && node.children) {
        // Handle formatted nodes
        for (const child of node.children) {
          if (child.type === VDOM_NODE_TYPES.TEXT) {
            const length = child.content?.length || 0;
            positions.push({
              node: child,
              start: currentOffset,
              end: currentOffset + length,
            });
            currentOffset += length;
          }
        }
      }
    }

    return positions;
  }

  public getTextContent(vdom: VDOMNode[]): string {
    // Extract all text content from VDOM nodes, recursively traversing formatting containers
    let result = '';

    function traverse(nodes: VDOMNode[]): void {
      for (const node of nodes) {
        if (node.type === VDOM_NODE_TYPES.TEXT) {
          result += node.content || '';
        } else if (node.children) {
          traverse(node.children);
        }
      }
    }

    traverse(vdom);
    return result;
  }
}
