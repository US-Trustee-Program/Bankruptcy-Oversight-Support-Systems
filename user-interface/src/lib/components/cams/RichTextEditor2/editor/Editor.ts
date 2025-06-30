import * as React from 'react';
import { EditorStateMachine, EditorEvent, EditorState } from '../state-machine/StateMachine';
import { VirtualDOMTree } from '../virtual-dom/VirtualDOMTree';
import { VNode, ElementNode, isElementNode } from '../virtual-dom/VNode';
import { createTextNode, createFormattingNode } from '../virtual-dom/VNodeFactory';
import { insertNode, removeNode } from '../virtual-dom/VirtualDOMOperations';
import { HtmlCodec } from '../virtual-dom/HtmlCodec';
import { SelectionService } from '../SelectionService.humble';
import { ZERO_WIDTH_SPACE } from '../../RichTextEditor/Editor.constants';
import { FormatType, getSelectionFormattingState } from './services/FormattingDetectionService';
import { removeFormattingFromSelection } from './services/FormattingRemovalService';
import {
  splitParagraphAtCursor,
  mergeParagraphs,
  findParagraphAtCursor,
  getCursorPositionInParagraph,
  createParagraphNode,
} from './services/ParagraphOperationsService';

export interface EditorChangeListener {
  (html: string): void;
}

/**
 * Editor class encapsulates all rich text editor logic, including FSM, virtual DOM,
 * and content management. This follows the CAMS dependency inversion principle
 * by providing a clean abstraction for the React component to depend.
 */
export class Editor {
  private stateMachine: EditorStateMachine;
  private virtualDOM: VirtualDOMTree;
  private selectionService: SelectionService;
  private rootElement: HTMLElement;
  private changeListeners: EditorChangeListener[] = [];
  private isDisabled: boolean = false;

  constructor(rootElement: HTMLElement, selectionService: SelectionService) {
    this.rootElement = rootElement;
    this.selectionService = selectionService;
    this.stateMachine = new EditorStateMachine();
    this.virtualDOM = new VirtualDOMTree();
  }

  // Content management methods (matching RichTextEditor2Ref interface)
  clearValue(): void {
    // Clear the virtual DOM tree by removing all children from the root
    const root = this.virtualDOM.getRoot();
    const children = [...root.children]; // Create a copy to avoid mutation during iteration
    children.forEach((child) => removeNode(child));

    // Update real DOM
    this.rootElement.innerHTML = '';

    // Notify change
    this.notifyChange('');
  }

  getValue(): string {
    // Get text content from virtual DOM
    return this.virtualDOM.getTextContent();
  }

  getHtml(): string {
    // Get HTML from virtual DOM using codec
    return HtmlCodec.encode(this.virtualDOM.getRoot());
  }

  setValue(html: string): void {
    // Parse HTML and update virtual DOM
    const parsedTree = HtmlCodec.decode(html);

    // Clear existing content
    const root = this.virtualDOM.getRoot();
    const children = [...root.children];
    children.forEach((child) => removeNode(child));

    // Add new content from the parsed tree
    if (parsedTree.children.length > 0) {
      // Create a copy of the children array to avoid modification during iteration
      const childrenToAdd = [...parsedTree.children];
      childrenToAdd.forEach((child: VNode) => {
        insertNode(root, child, root.children.length);
      });
    }

    // Update real DOM
    this.rootElement.innerHTML = html;
  }

  focus(): void {
    this.rootElement.focus();
  }

  disable(disabled: boolean): void {
    this.isDisabled = disabled;
    this.rootElement.contentEditable = disabled ? 'false' : 'true';
  }

  // Browser event handling methods (return boolean if the event was handled)
  handleInput(e: React.FormEvent<HTMLDivElement>): boolean {
    if (this.isDisabled) {
      return false;
    }

    // Dispatch INPUT event to state machine
    this.stateMachine.dispatch(EditorEvent.INPUT);

    // Get current content from DOM and update virtual DOM
    const currentContent = (e.target as HTMLDivElement).innerText;

    // Update virtual DOM with new content
    // For basic text input, we'll replace the content with a single text node
    const root = this.virtualDOM.getRoot();
    const children = [...root.children];
    children.forEach((child) => removeNode(child));

    if (currentContent) {
      const textNode = createTextNode(currentContent);
      insertNode(root, textNode, 0);
    }

    // Notify change
    this.notifyChange(this.getHtml());
    return true;
  }

  handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    if (this.isDisabled) {
      return false;
    }

    // Handle keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          this.stateMachine.dispatch(EditorEvent.KEYBOARD_SHORTCUT);
          this.toggleFormatting('bold');
          return true;
        case 'i':
          e.preventDefault();
          this.stateMachine.dispatch(EditorEvent.KEYBOARD_SHORTCUT);
          this.toggleFormatting('italic');
          return true;
        case 'u':
          e.preventDefault();
          this.stateMachine.dispatch(EditorEvent.KEYBOARD_SHORTCUT);
          this.toggleFormatting('underline');
          return true;
      }
    }

    // Handle paragraph operations
    switch (e.key) {
      case 'Enter':
        return this.handleEnterKey(e);
      case 'Backspace':
        return this.handleBackspaceKey(e);
      case 'Delete':
        return this.handleDeleteKey(e);
    }

    return false;
  }

  handlePaste(e: React.ClipboardEvent<HTMLDivElement>): boolean {
    if (this.isDisabled) {
      return false;
    }

    e.preventDefault();

    // Get pasted content
    const pastedText = e.clipboardData.getData('text/plain');

    if (pastedText.trim()) {
      // Split pasted text by newlines to create multiple paragraphs
      const lines = pastedText.split('\n').filter((line) => line.trim() !== '');

      if (lines.length === 0) {
        return true; // No content to paste
      }

      const root = this.virtualDOM.getRoot();

      // Create paragraph nodes for each line
      lines.forEach((line) => {
        const paragraphNode = createParagraphNode({}, line.trim());
        insertNode(root, paragraphNode, root.children.length);
      });

      // Encode the updated virtual DOM to HTML
      const newHtml = HtmlCodec.encode(root);

      // Update real DOM
      this.rootElement.innerHTML = newHtml;

      // Notify change
      this.notifyChange(newHtml);
    }
    return true;
  }

  // Change listener registration for the React component
  onContentChange(listener: EditorChangeListener): void {
    this.changeListeners.push(listener);
  }

  removeContentChangeListener(listener: EditorChangeListener): void {
    const index = this.changeListeners.indexOf(listener);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  // State management
  getCurrentState(): EditorState {
    return this.stateMachine.getCurrentState();
  }

  // Cleanup
  destroy(): void {
    this.changeListeners = [];
  }

  // Private methods
  private notifyChange(html: string): void {
    this.changeListeners.forEach((listener) => listener(html));
  }

  /**
   * Toggle formatting on the currently selected text
   * If the selection already has the formatting, remove it; otherwise, apply it
   */
  private toggleFormatting(formatType: FormatType): void {
    const selection = this.selectionService.getCurrentSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    // Check the current formatting state of the selection
    const formattingState = getSelectionFormattingState(selection, formatType, this.rootElement);

    if (formattingState === 'all' || formattingState === 'partial') {
      // Remove formatting if it exists (fully or partially)
      removeFormattingFromSelection(selection, formatType, this.rootElement);
    } else {
      // Apply formatting if it doesn't exist
      this.applyFormattingToSelection(selection, formatType);
    }

    // Update the virtual DOM by reparsing the current content
    const currentHtml = this.rootElement.innerHTML;
    this.setValue(currentHtml);

    // Notify change
    this.notifyChange(this.getHtml());
  }

  /**
   * Apply formatting to the current selection
   */
  private applyFormattingToSelection(selection: Selection, formatType: FormatType): void {
    const range = selection.getRangeAt(0);
    const selectedText = this.selectionService.getSelectedText();

    if (!selectedText.trim()) {
      return; // Don't format empty selections
    }

    // Create a formatting node with the selected text as a child
    const textNode = createTextNode(selectedText);
    const formattingNode = createFormattingNode(formatType);

    // Add the text node as a child of the formatting node
    insertNode(formattingNode, textNode, 0);

    // Replace the selected content with the formatted content
    range.deleteContents();

    // Create the HTML element for the formatting
    const formattingElement = document.createElement(formattingNode.tagName);
    formattingElement.textContent = selectedText;

    // Insert the formatted element
    range.insertNode(formattingElement);

    // Clear selection
    selection.removeAllRanges();
  }

  /**
   * Handle Enter key for paragraph creation
   */
  private handleEnterKey(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    e.preventDefault();
    this.stateMachine.dispatch(EditorEvent.INPUT);

    // Get current selection to determine cursor position
    const selection = this.selectionService.getCurrentSelection();
    if (!selection || selection.rangeCount === 0) {
      // No selection, add empty paragraph at end
      const currentHtml = this.rootElement.innerHTML;
      const newHtml = currentHtml + `<p>${ZERO_WIDTH_SPACE}</p>`;
      this.rootElement.innerHTML = newHtml;
      this.setValue(newHtml);
      this.notifyChange(newHtml);
      return true;
    }

    const range = selection.getRangeAt(0);
    const cursorPosition = range.startOffset;

    // Find the paragraph containing the cursor
    const currentParagraph = findParagraphAtCursor(this.virtualDOM.getRoot(), cursorPosition);

    if (!currentParagraph) {
      // No paragraph found, create new paragraph
      const currentHtml = this.rootElement.innerHTML;
      const newHtml = currentHtml + `<p>${ZERO_WIDTH_SPACE}</p>`;
      this.rootElement.innerHTML = newHtml;
      this.setValue(newHtml);
      this.notifyChange(newHtml);
      return true;
    }

    // Split the paragraph at the cursor position (using absolute position)
    const splitResult = splitParagraphAtCursor(currentParagraph, cursorPosition);

    // Update the virtual DOM with the split paragraphs
    if (currentParagraph.parent) {
      const parentNode = currentParagraph.parent;
      const currentIndex = parentNode.children.indexOf(currentParagraph);

      if (currentIndex !== -1) {
        // Remove the original paragraph
        parentNode.children.splice(currentIndex, 1);

        // Insert the split paragraphs
        parentNode.children.splice(
          currentIndex,
          0,
          splitResult.firstParagraph,
          splitResult.secondParagraph,
        );
        splitResult.firstParagraph.parent = parentNode;
        splitResult.secondParagraph.parent = parentNode;
      }
    }

    // Encode the updated virtual DOM to HTML
    const newHtml = HtmlCodec.encode(this.virtualDOM.getRoot());

    // Update both DOM and notify change
    this.rootElement.innerHTML = newHtml;
    this.notifyChange(newHtml);
    return true;
  }

  /**
   * Handle Backspace key for paragraph merging
   */
  private handleBackspaceKey(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    e.preventDefault();
    this.stateMachine.dispatch(EditorEvent.INPUT);

    // Get current selection to determine cursor position
    const selection = this.selectionService.getCurrentSelection();
    if (!selection || selection.rangeCount === 0) {
      return false;
    }

    const range = selection.getRangeAt(0);
    const cursorPosition = range.startOffset;

    // Find the paragraph containing the cursor
    const currentParagraph = findParagraphAtCursor(this.virtualDOM.getRoot(), cursorPosition);

    if (!currentParagraph || !currentParagraph.parent) {
      return false;
    }

    // Get relative cursor position within the paragraph
    const relativeCursorPosition = getCursorPositionInParagraph(currentParagraph, cursorPosition);

    // Check if cursor is at the beginning of the paragraph
    if (relativeCursorPosition === 0) {
      // Find the previous paragraph to merge with
      const parentNode = currentParagraph.parent;
      const currentIndex = parentNode.children.indexOf(currentParagraph);

      if (currentIndex > 0) {
        const previousChild = parentNode.children[currentIndex - 1];

        // Check if the previous child is also a paragraph
        if (isElementNode(previousChild) && previousChild.tagName === 'p') {
          const previousParagraph = previousChild as ElementNode;

          // Merge the paragraphs
          const mergedParagraph = mergeParagraphs(previousParagraph, currentParagraph);

          // Update the virtual DOM
          parentNode.children.splice(currentIndex - 1, 2, mergedParagraph);
          mergedParagraph.parent = parentNode;

          // Encode the updated virtual DOM to HTML
          const newHtml = HtmlCodec.encode(this.virtualDOM.getRoot());

          // Update both DOM and notify change
          this.rootElement.innerHTML = newHtml;
          this.notifyChange(newHtml);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Handle Delete key for paragraph merging
   */
  private handleDeleteKey(e: React.KeyboardEvent<HTMLDivElement>): boolean {
    e.preventDefault();
    this.stateMachine.dispatch(EditorEvent.INPUT);

    // Get current selection to determine cursor position
    const selection = this.selectionService.getCurrentSelection();
    if (!selection || selection.rangeCount === 0) {
      return false;
    }

    const range = selection.getRangeAt(0);
    const cursorPosition = range.startOffset;

    // Find the paragraph containing the cursor
    const currentParagraph = findParagraphAtCursor(this.virtualDOM.getRoot(), cursorPosition);

    if (!currentParagraph || !currentParagraph.parent) {
      return false;
    }

    // Get relative cursor position within the paragraph
    const relativeCursorPosition = getCursorPositionInParagraph(currentParagraph, cursorPosition);
    const paragraphLength = currentParagraph.endOffset - currentParagraph.startOffset;

    // Check if cursor is at the end of the paragraph or at the last character
    if (
      relativeCursorPosition === paragraphLength ||
      relativeCursorPosition === paragraphLength - 1
    ) {
      // Find the next paragraph to merge with
      const parentNode = currentParagraph.parent;
      const currentIndex = parentNode.children.indexOf(currentParagraph);

      if (currentIndex < parentNode.children.length - 1) {
        const nextChild = parentNode.children[currentIndex + 1];

        // Check if the next child is also a paragraph
        if (isElementNode(nextChild) && nextChild.tagName === 'p') {
          const nextParagraph = nextChild as ElementNode;

          // Merge the paragraphs (current paragraph first, then next)
          const mergedParagraph = mergeParagraphs(currentParagraph, nextParagraph);

          // Update the virtual DOM
          parentNode.children.splice(currentIndex, 2, mergedParagraph);
          mergedParagraph.parent = parentNode;

          // Encode the updated virtual DOM to HTML
          const newHtml = HtmlCodec.encode(this.virtualDOM.getRoot());

          // Update both DOM and notify change
          this.rootElement.innerHTML = newHtml;
          this.notifyChange(newHtml);
          return true;
        }
      }
    }

    return false;
  }
}
