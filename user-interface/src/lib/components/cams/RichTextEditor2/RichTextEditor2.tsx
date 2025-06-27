import './RichTextEditor2.scss';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StateMachineProvider, useStateMachine } from './StateMachineContext';
import { EditorEvent } from './StateMachine';
import { VirtualDOMTree } from './virtual-dom/VirtualDOMTree';
import { VNode } from './virtual-dom/VNode';
import { createTextNode, createFormattingNode } from './virtual-dom/VNodeFactory';
import { insertNode, removeNode } from './virtual-dom/VirtualDOMOperations';
import { HtmlCodec } from './virtual-dom/HtmlCodec';
import { BrowserSelectionService, type SelectionService } from './SelectionService.humble';
import { FormattingType } from './formatting-analysis.types';
import * as React from 'react';

export interface RichTextEditor2Ref {
  clearValue: () => void;
  getValue: () => string;
  getHtml: () => string;
  setValue: (value: string) => void;
  disable: (value: boolean) => void;
  focus: () => void;
}

export interface RichTextEditor2Props {
  id: string;
  label?: string;
  ariaDescription?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

function _RichTextEditor2Internal(props: RichTextEditor2Props, ref: React.Ref<RichTextEditor2Ref>) {
  const { id, label, ariaDescription, onChange, required, className, disabled } = props;

  const contentRef = useRef<HTMLDivElement>(null);
  const [inputDisabled, setInputDisabled] = useState<boolean>(disabled || false);
  const { dispatch } = useStateMachine();

  // Initialize virtual DOM tree
  const virtualDOMRef = useRef<VirtualDOMTree>(new VirtualDOMTree());

  // Initialize selection service
  const selectionServiceRef = useRef<SelectionService>(
    new BrowserSelectionService(window, document),
  );

  /**
   * Toggle formatting for the currently selected text
   */
  const toggleFormatting = (formatType: FormattingType) => {
    const selection = selectionServiceRef.current.getCurrentSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selectionServiceRef.current.getSelectedText();

    // If no text is selected, check if cursor is within formatted content
    if (!selectedText.trim()) {
      // Check if cursor is within formatted content by examining the range container
      const isInFormattedContent = isSelectionAlreadyFormatted(range, formatType);

      if (isInFormattedContent) {
        // Remove formatting from the entire formatted element containing the cursor
        removeFormattingFromDOM(range, formatType);

        // Update virtual DOM to reflect DOM changes
        if (contentRef.current) {
          const updatedHtml = contentRef.current.innerHTML;
          setValue(updatedHtml);
        }

        // Notify change
        onChange?.(getHtml());
        return;
      }

      // TODO: In a complete implementation, we might want to:
      // 1. Apply formatting to the current word
      // 2. Set formatting state for subsequent typing
      // For now, just return early for empty selections in unformatted content
      return;
    }

    // Check if the selection is already formatted by examining DOM elements
    const isAlreadyFormatted = isSelectionAlreadyFormatted(range, formatType);

    if (isAlreadyFormatted) {
      // Remove formatting by unwrapping the formatting element
      removeFormattingFromDOM(range, formatType);
    } else {
      // For mixed selections, first remove any existing formatting, then apply new formatting

      // Store the original selected text before DOM manipulation
      const originalText = selectedText;

      removeAnyExistingFormattingFromSelection(range, formatType);

      // After removing existing formatting, find the text in the cleaned DOM
      // and apply formatting to the entire intended selection
      if (contentRef.current && originalText.trim()) {
        const editorContent = contentRef.current.textContent || '';
        const textIndex = editorContent.indexOf(originalText);

        if (textIndex >= 0) {
          // Create a new range that spans the entire original text in the cleaned DOM
          const newRange = document.createRange();

          // Find the text nodes that contain our text
          const walker = document.createTreeWalker(contentRef.current, NodeFilter.SHOW_TEXT, null);

          let currentOffset = 0;
          let startNode: Node | null = null;
          let endNode: Node | null = null;
          let startOffsetInNode = 0;
          let endOffsetInNode = 0;

          let textNode = walker.nextNode();
          while (textNode && currentOffset < textIndex + originalText.length) {
            const nodeText = textNode.textContent || '';
            const nodeLength = nodeText.length;

            // Check if this node contains the start of our text
            if (!startNode && currentOffset + nodeLength > textIndex) {
              startNode = textNode;
              startOffsetInNode = textIndex - currentOffset;
            }

            // Check if this node contains the end of our text
            if (currentOffset + nodeLength >= textIndex + originalText.length) {
              endNode = textNode;
              endOffsetInNode = textIndex + originalText.length - currentOffset;
              break;
            }

            currentOffset += nodeLength;
            textNode = walker.nextNode();
          }

          if (startNode && endNode) {
            newRange.setStart(startNode, startOffsetInNode);
            newRange.setEnd(endNode, endOffsetInNode);
            applyFormattingToSelection(formatType, originalText, newRange);
          } else {
            // Fallback: apply to original range
            applyFormattingToSelection(formatType, originalText, range);
          }
        }
      }
    }

    // Update virtual DOM to reflect DOM changes
    if (contentRef.current) {
      const updatedHtml = contentRef.current.innerHTML;
      setValue(updatedHtml);
    }

    // Notify change (keep selection intact for user experience)
    onChange?.(getHtml());
  };

  /**
   * Check if the current selection is already formatted with the specified format type
   * Returns true only if the ENTIRE selection is formatted, not just part of it
   */
  const isSelectionAlreadyFormatted = (range: Range, formatType: FormattingType): boolean => {
    const tagName = getTagNameForFormat(formatType);

    // For collapsed ranges (just cursor position), check if cursor is within formatted content
    if (range.collapsed) {
      let currentNode: Node | null = range.startContainer;
      while (currentNode && currentNode !== contentRef.current) {
        if (currentNode.nodeType === Node.ELEMENT_NODE) {
          const element = currentNode as Element;
          if (element.tagName.toLowerCase() === tagName.toLowerCase()) {
            return true;
          }
        }
        currentNode = currentNode.parentNode;
      }
      return false;
    }

    // For actual selections, check if the entire selection is within a single formatting element
    // This is a simplified approach - we check if both start and end are within the same formatting element
    const startFormatElement = findFormattingAncestor(range.startContainer, tagName);
    const endFormatElement = findFormattingAncestor(range.endContainer, tagName);

    // If both start and end are in the same formatting element, consider it fully formatted
    if (startFormatElement && endFormatElement && startFormatElement === endFormatElement) {
      return true;
    }

    return false;
  };

  /**
   * Helper function to find the closest formatting ancestor of a node
   */
  const findFormattingAncestor = (node: Node, tagName: string): Element | null => {
    let currentNode: Node | null = node;
    while (currentNode && currentNode !== contentRef.current) {
      if (currentNode.nodeType === Node.ELEMENT_NODE) {
        const element = currentNode as Element;
        if (element.tagName.toLowerCase() === tagName.toLowerCase()) {
          return element;
        }
      }
      currentNode = currentNode.parentNode;
    }
    return null;
  };

  /**
   * Remove any existing formatting of the specified type from a selection
   * This handles mixed selections where part of the text is formatted
   */
  const removeAnyExistingFormattingFromSelection = (
    range: Range,
    formatType: FormattingType,
  ): void => {
    const tagName = getTagNameForFormat(formatType);

    // Find all formatting elements that intersect with the selection
    const commonAncestor = range.commonAncestorContainer;
    const formattingElements: Element[] = [];

    // Get all formatting elements within the common ancestor
    if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
      const elements = (commonAncestor as Element).getElementsByTagName(tagName);
      for (let i = 0; i < elements.length; i++) {
        const elem = elements[i];
        if (range.intersectsNode(elem)) {
          formattingElements.push(elem);
        }
      }
    }

    // Also check if the range containers themselves are formatting elements
    const startFormatElement = findFormattingAncestor(range.startContainer, tagName);
    const endFormatElement = findFormattingAncestor(range.endContainer, tagName);

    if (startFormatElement && !formattingElements.includes(startFormatElement)) {
      formattingElements.push(startFormatElement);
    }
    if (endFormatElement && !formattingElements.includes(endFormatElement)) {
      formattingElements.push(endFormatElement);
    }

    // Unwrap all found formatting elements
    formattingElements.forEach((formattingElement) => {
      const parent = formattingElement.parentNode;
      if (parent) {
        // Move all children of the formatting element to its parent
        while (formattingElement.firstChild) {
          parent.insertBefore(formattingElement.firstChild, formattingElement);
        }
        // Remove the empty formatting element
        parent.removeChild(formattingElement);
      }
    });
  };

  /**
   * Remove formatting from the DOM by unwrapping formatting elements
   */
  const removeFormattingFromDOM = (range: Range, formatType: FormattingType): void => {
    const tagName = getTagNameForFormat(formatType);

    // Find all formatting elements that intersect with the selection
    const formattingElements: Element[] = [];

    // Start from the start container and walk up to find formatting elements
    let currentNode: Node | null = range.startContainer;
    while (currentNode && currentNode !== contentRef.current) {
      if (currentNode.nodeType === Node.ELEMENT_NODE) {
        const element = currentNode as Element;
        if (element.tagName.toLowerCase() === tagName.toLowerCase()) {
          formattingElements.push(element);
        }
      }
      currentNode = currentNode.parentNode;
    }

    // Also check if the range contains any formatting elements
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      const commonAncestor = range.commonAncestorContainer;
      if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
        const elements = (commonAncestor as Element).getElementsByTagName(tagName);
        for (let i = 0; i < elements.length; i++) {
          const elem = elements[i];
          if (range.intersectsNode(elem) && !formattingElements.includes(elem)) {
            formattingElements.push(elem);
          }
        }
      }
    }

    // Unwrap all found formatting elements
    formattingElements.forEach((formattingElement) => {
      const parent = formattingElement.parentNode;
      if (parent) {
        // Move all children of the formatting element to its parent
        while (formattingElement.firstChild) {
          parent.insertBefore(formattingElement.firstChild, formattingElement);
        }
        // Remove the empty formatting element
        parent.removeChild(formattingElement);
      }
    });
  };

  /**
   * Get the HTML tag name for a formatting type
   */
  const getTagNameForFormat = (formatType: FormattingType): string => {
    switch (formatType) {
      case 'bold':
        return 'strong';
      case 'italic':
        return 'em';
      case 'underline':
        return 'u';
      default:
        return '';
    }
  };

  /**
   * Apply formatting to the currently selected text (helper function)
   * TODO: This should be replaced with virtual DOM-based formatting application
   */
  const applyFormattingToSelection = (
    formatType: FormattingType,
    selectedText: string,
    range: Range,
  ) => {
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

    // Update the virtual DOM by re-parsing the current content
    if (contentRef.current) {
      const currentHtml = contentRef.current.innerHTML;
      setValue(currentHtml);
    }
  };

  const clearValue = () => {
    // Clear the virtual DOM tree by removing all children from the root
    const root = virtualDOMRef.current.getRoot();
    const children = [...root.children]; // Create a copy to avoid mutation during iteration
    children.forEach((child) => removeNode(child));

    // Update real DOM
    if (contentRef.current) {
      contentRef.current.innerHTML = '';
    }

    // Notify change
    onChange?.('');
  };

  const getValue = () => {
    // Get text content from virtual DOM
    return virtualDOMRef.current.getTextContent();
  };

  const getHtml = () => {
    // Get HTML from virtual DOM using codec
    return HtmlCodec.encode(virtualDOMRef.current.getRoot());
  };

  const setValue = (html: string) => {
    // Parse HTML and update virtual DOM
    const parsedTree = HtmlCodec.decode(html);

    // Clear existing content
    const root = virtualDOMRef.current.getRoot();
    const children = [...root.children];
    children.forEach((child) => removeNode(child));

    // Add new content from the parsed tree
    if (parsedTree.children.length > 0) {
      parsedTree.children.forEach((child: VNode) => {
        insertNode(root, child, root.children.length);
      });
    }

    // Update real DOM
    if (contentRef.current) {
      contentRef.current.innerHTML = html;
    }
  };

  const disable = (val: boolean) => {
    setInputDisabled(val);
  };

  const focus = () => {
    if (contentRef.current) {
      contentRef.current.focus();
    }
  };

  useImperativeHandle(ref, () => ({
    clearValue,
    getValue,
    getHtml,
    setValue,
    disable,
    focus,
  }));

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    // Dispatch INPUT event to state machine
    dispatch(EditorEvent.INPUT);

    // Get current content from DOM and update virtual DOM
    const currentContent = (e.target as HTMLDivElement).innerText;

    // Update virtual DOM with new content
    // For basic text input, we'll replace the content with a single text node
    const root = virtualDOMRef.current.getRoot();
    const children = [...root.children];
    children.forEach((child) => removeNode(child));

    if (currentContent) {
      const textNode = createTextNode(currentContent);
      insertNode(root, textNode, 0);
    }

    // Notify change
    onChange?.(getHtml());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Handle keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          dispatch(EditorEvent.KEYBOARD_SHORTCUT);
          toggleFormatting('bold');
          break;
        case 'i':
          e.preventDefault();
          dispatch(EditorEvent.KEYBOARD_SHORTCUT);
          toggleFormatting('italic');
          break;
        case 'u':
          e.preventDefault();
          dispatch(EditorEvent.KEYBOARD_SHORTCUT);
          toggleFormatting('underline');
          break;
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();

    // Get pasted content
    const pastedText = e.clipboardData.getData('text/plain');

    if (pastedText) {
      // Update virtual DOM with pasted content
      const root = virtualDOMRef.current.getRoot();
      const textNode = createTextNode(pastedText);
      insertNode(root, textNode, root.children.length);

      // Update real DOM
      if (contentRef.current) {
        contentRef.current.innerText = pastedText;
      }

      // Notify change
      onChange?.(getHtml());
    }
  };

  return (
    <div id={`${id}-container`} className="usa-form-group rich-text-editor-container">
      {label && (
        <label
          id={`editor-label-${id}`}
          className={`usa-label ${className ? `${className}-label` : ''}`}
        >
          {label}
          {required && <span className="required-form-field" />}
        </label>
      )}

      {ariaDescription && (
        <div className="usa-hint" id={`editor-hint-${id}`}>
          {ariaDescription}
        </div>
      )}

      {/* TODO: Implement toolbar with state machine integration */}
      <div className="editor-toolbar">
        {/* Toolbar buttons will be implemented with the state machine */}
      </div>

      <div
        id={id}
        data-testid={id}
        className={`editor-content ${className || ''}`}
        contentEditable={!inputDisabled}
        tabIndex={0}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        ref={contentRef}
        aria-labelledby={label ? `editor-label-${id}` : undefined}
        aria-describedby={ariaDescription ? `editor-hint-${id}` : undefined}
        role="textbox"
        aria-multiline="true"
        suppressContentEditableWarning
      />
    </div>
  );
}

const RichTextEditor2Internal = forwardRef(_RichTextEditor2Internal);

function _RichTextEditor2(props: RichTextEditor2Props, ref: React.Ref<RichTextEditor2Ref>) {
  return (
    <StateMachineProvider>
      <RichTextEditor2Internal {...props} ref={ref} />
    </StateMachineProvider>
  );
}

const RichTextEditor2 = forwardRef(_RichTextEditor2);
export default RichTextEditor2;
