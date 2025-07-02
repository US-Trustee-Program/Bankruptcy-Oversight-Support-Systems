/**
 * BeforeInput Event Strategy Implementation
 * Implementation of DECISION-014: BeforeInput Event Strategy
 */

import { EditorState } from './EditorState';
import { TextNode } from '../virtual-dom/VNode';
import {
  createInsertTextOperation,
  createDeleteTextOperation,
  UndoRedoService,
} from './UndoRedoService';
import { PathBasedSelectionService } from './PathBasedSelectionService';

/**
 * Handler for beforeinput events
 * Provides clear user intent before DOM mutation occurs
 */
export interface BeforeInputHandler {
  /** Handle text insertion */
  handleInsertText(inputEvent: InputEvent, currentState: EditorState): EditorState;
  /** Handle backward deletion (Backspace key) */
  handleDeleteContentBackward(inputEvent: InputEvent, currentState: EditorState): EditorState;
  /** Handle forward deletion (Delete key) */
  handleDeleteContentForward(inputEvent: InputEvent, currentState: EditorState): EditorState;
  /** Handle paragraph insertion (Enter key) */
  handleInsertParagraph(inputEvent: InputEvent, currentState: EditorState): EditorState;
  /** Handle line break insertion (Shift+Enter) */
  handleInsertLineBreak(inputEvent: InputEvent, currentState: EditorState): EditorState;
  /** Check if input type is supported */
  isSupportedInputType(inputType: string): boolean;
}

/**
 * Implementation of beforeinput event handlers
 * All handlers prevent default browser behavior and use virtual DOM operations
 */
export class BeforeInputHandlerImpl implements BeforeInputHandler {
  constructor(
    private readonly undoRedoService: UndoRedoService,
    private readonly selectionService: PathBasedSelectionService,
  ) {}

  handleInsertText(inputEvent: InputEvent, currentState: EditorState): EditorState {
    // Prevent browser's default text insertion
    inputEvent.preventDefault();

    const data = inputEvent.data || '';
    if (!data) {
      return currentState;
    }

    // Get current selection
    const { selection } = currentState;

    // If we have a range selection, delete the selected content first
    let newState = currentState;
    if (!selection.isCollapsed) {
      newState = this.deleteSelectedContent(newState);
    }

    // Create insert text operation
    const insertOperation = createInsertTextOperation({
      path: newState.selection.startPath,
      offset: newState.selection.startOffset,
      text: data,
    });

    // Execute operation through undo/redo service
    return this.undoRedoService.execute(insertOperation);
  }

  handleDeleteContentBackward(inputEvent: InputEvent, currentState: EditorState): EditorState {
    // Prevent browser's default deletion
    inputEvent.preventDefault();

    const { selection } = currentState;

    // If we have a range selection, delete the selected content
    if (!selection.isCollapsed) {
      return this.deleteSelectedContent(currentState);
    }

    // For collapsed selection, delete one character backward
    if (selection.startOffset > 0) {
      const deleteOperation = createDeleteTextOperation({
        path: selection.startPath,
        startOffset: selection.startOffset - 1,
        endOffset: selection.startOffset,
        deletedText: '', // This will be filled by the actual deletion logic
      });

      return this.undoRedoService.execute(deleteOperation);
    }

    // Handle special cases like merging paragraphs
    return this.handleBackspaceAtStartOfParagraph(currentState);
  }

  handleDeleteContentForward(inputEvent: InputEvent, currentState: EditorState): EditorState {
    // Prevent browser's default deletion
    inputEvent.preventDefault();

    const { selection } = currentState;

    // If we have a range selection, delete the selected content
    if (!selection.isCollapsed) {
      return this.deleteSelectedContent(currentState);
    }

    // For collapsed selection, delete one character forward
    const targetNode = this.selectionService.pathToNode(
      currentState.virtualDOM,
      selection.startPath,
    );
    if (targetNode && targetNode.type === 'text') {
      const textContent = (targetNode as TextNode).content || '';
      if (selection.startOffset < textContent.length) {
        const deleteOperation = createDeleteTextOperation({
          path: selection.startPath,
          startOffset: selection.startOffset,
          endOffset: selection.startOffset + 1,
          deletedText: '', // This will be filled by the actual deletion logic
        });

        return this.undoRedoService.execute(deleteOperation);
      }
    }

    // Handle special cases like merging with next paragraph
    return this.handleDeleteAtEndOfParagraph(currentState);
  }

  handleInsertParagraph(inputEvent: InputEvent, currentState: EditorState): EditorState {
    // Prevent browser's default paragraph insertion
    inputEvent.preventDefault();

    // TODO: Implement paragraph insertion operation
    // This will create a new paragraph and split content if necessary
    console.log('Paragraph insertion not yet implemented');
    return currentState;
  }

  handleInsertLineBreak(inputEvent: InputEvent, currentState: EditorState): EditorState {
    // Prevent browser's default line break insertion
    inputEvent.preventDefault();

    // TODO: Implement line break insertion operation
    // This will insert a <br> tag instead of creating a new paragraph
    console.log('Line break insertion not yet implemented');
    return currentState;
  }

  isSupportedInputType(inputType: string): boolean {
    const supportedTypes = [
      'insertText',
      'deleteContentBackward',
      'deleteContentForward',
      'insertParagraph',
      'insertLineBreak',
      'insertFromPaste',
      'insertCompositionText',
      'deleteCompositionText',
    ];

    return supportedTypes.includes(inputType);
  }

  /**
   * Delete currently selected content
   */
  private deleteSelectedContent(currentState: EditorState): EditorState {
    const { selection } = currentState;

    if (selection.isCollapsed) {
      return currentState;
    }

    // TODO: Implement range deletion
    // This needs to handle complex cases like deletion across multiple nodes
    console.log('Range deletion not yet implemented');
    return currentState;
  }

  /**
   * Handle Backspace key at the start of a paragraph
   * This may involve merging with the previous paragraph
   */
  private handleBackspaceAtStartOfParagraph(currentState: EditorState): EditorState {
    // TODO: Implement paragraph merging logic
    console.log('Paragraph merging not yet implemented');
    return currentState;
  }

  /**
   * Handle Delete key at the end of a paragraph
   * This may involve merging with the next paragraph
   */
  private handleDeleteAtEndOfParagraph(currentState: EditorState): EditorState {
    // TODO: Implement forward paragraph merging logic
    console.log('Forward paragraph merging not yet implemented');
    return currentState;
  }
}

/**
 * Event listener setup for beforeinput events
 */
export class BeforeInputEventManager {
  constructor(
    private readonly handler: BeforeInputHandler,
    private readonly onStateChange: (newState: EditorState) => void,
  ) {}

  /**
   * Set up beforeinput event listener on the editor element
   */
  setupEventListener(element: HTMLElement, getCurrentState: () => EditorState): void {
    element.addEventListener('beforeinput', (event) => {
      this.handleBeforeInput(event as InputEvent, getCurrentState());
    });
  }

  /**
   * Handle beforeinput event and route to appropriate handler
   */
  private handleBeforeInput(event: InputEvent, currentState: EditorState): void {
    if (!this.handler.isSupportedInputType(event.inputType)) {
      // Allow unsupported input types to proceed normally
      return;
    }

    let newState: EditorState;

    switch (event.inputType) {
      case 'insertText':
      case 'insertCompositionText':
        newState = this.handler.handleInsertText(event, currentState);
        break;

      case 'deleteContentBackward':
      case 'deleteCompositionText':
        newState = this.handler.handleDeleteContentBackward(event, currentState);
        break;

      case 'deleteContentForward':
        newState = this.handler.handleDeleteContentForward(event, currentState);
        break;

      case 'insertParagraph':
        newState = this.handler.handleInsertParagraph(event, currentState);
        break;

      case 'insertLineBreak':
        newState = this.handler.handleInsertLineBreak(event, currentState);
        break;

      case 'insertFromPaste':
        // Handle paste operations
        newState = this.handlePaste(event, currentState);
        break;

      default:
        // For unsupported but recognized types, prevent default and maintain state
        event.preventDefault();
        newState = currentState;
        break;
    }

    // Notify of state change
    if (newState !== currentState) {
      this.onStateChange(newState);
    }
  }

  /**
   * Handle paste operations
   */
  private handlePaste(event: InputEvent, currentState: EditorState): EditorState {
    event.preventDefault();

    // TODO: Implement paste handling with content sanitization
    console.log('Paste handling not yet implemented');
    return currentState;
  }
}

/**
 * Helper functions for beforeinput event handling
 */

/**
 * Extract text data from input event
 */
export function getInputEventData(event: InputEvent): string {
  return event.data || '';
}

/**
 * Check if event represents a composition (IME input)
 */
export function isCompositionInput(event: InputEvent): boolean {
  return event.inputType === 'insertCompositionText' || event.inputType === 'deleteCompositionText';
}

/**
 * Check if event represents a deletion operation
 */
export function isDeletionInput(event: InputEvent): boolean {
  return (
    event.inputType === 'deleteContentBackward' ||
    event.inputType === 'deleteContentForward' ||
    event.inputType === 'deleteCompositionText'
  );
}

/**
 * Check if event represents an insertion operation
 */
export function isInsertionInput(event: InputEvent): boolean {
  return (
    event.inputType === 'insertText' ||
    event.inputType === 'insertCompositionText' ||
    event.inputType === 'insertParagraph' ||
    event.inputType === 'insertLineBreak' ||
    event.inputType === 'insertFromPaste'
  );
}
