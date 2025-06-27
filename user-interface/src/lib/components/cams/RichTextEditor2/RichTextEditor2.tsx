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
import { FormattingType, FormattingState } from './formatting-analysis.types';
import { SelectionFormattingAnalyzer } from './SelectionFormattingAnalyzer';
import { FormattingRemover } from './FormattingRemover';
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

  // Initialize formatting analyzer and remover
  const formattingAnalyzerRef = useRef<SelectionFormattingAnalyzer>(
    new SelectionFormattingAnalyzer()
  );

  const formattingRemoverRef = useRef<FormattingRemover>(
    new FormattingRemover()
  );

  /**
   * Toggle formatting for the currently selected text using virtual DOM
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
      // TODO: In a complete implementation, we might want to:
      // 1. Apply formatting to the current word
      // 2. Set formatting state for subsequent typing
      // For now, just return early for empty selections
      return;
    }

    // Get the current HTML content and parse it to virtual DOM
    if (!contentRef.current) {
      return;
    }

    const currentHtml = contentRef.current.innerHTML;
    const virtualDOM = HtmlCodec.decode(currentHtml);

    // Map the browser selection to virtual DOM nodes
    const selectedVNodes = selectionServiceRef.current.getVirtualNodesInSelection(
      virtualDOM,
      range,
      contentRef.current
    );

    if (selectedVNodes.length === 0) {
      return; // No virtual nodes found in selection
    }

    // Analyze the formatting state of the selection
    const formattingAnalysis = formattingAnalyzerRef.current.analyzeSelection(
      selectedVNodes,
      formatType
    );

    const formattingState = formattingAnalysis.formattingState;

    // Apply the appropriate action based on the formatting state
    if (formattingState === FormattingState.FULLY_APPLIED) {
      // If formatting is fully applied, remove it from the entire selection
      formattingRemoverRef.current.removeFormattingFromSelection(selectedVNodes, formatType);
    } else if (formattingState === FormattingState.NOT_APPLIED) {
      // If formatting is not applied, apply it to the entire selection
      applyFormattingToSelection(formatType, selectedText, range);
    } else {
      // If formatting is partially applied, apply it to unformatted parts
      // First, remove any existing formatting from the selection
      const cleanedNodes = formattingRemoverRef.current.removeFormattingFromSelection(
        selectedVNodes, 
        formatType
      );

      // Then apply formatting to the entire selection
      applyFormattingToSelection(formatType, selectedText, range);
    }

    // Update virtual DOM to reflect changes
    const updatedHtml = HtmlCodec.encode(virtualDOM);
    setValue(updatedHtml);

    // Notify change (keep selection intact for user experience)
    onChange?.(getHtml());
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
   * Apply formatting to the currently selected text using virtual DOM
   */
  const applyFormattingToSelection = (
    formatType: FormattingType,
    selectedText: string,
    range: Range,
  ) => {
    if (!contentRef.current) {
      return;
    }

    // Get the current HTML content and parse it to virtual DOM
    const currentHtml = contentRef.current.innerHTML;
    const virtualDOM = HtmlCodec.decode(currentHtml);

    // Map the browser selection to virtual DOM nodes
    const selectedVNodes = selectionServiceRef.current.getVirtualNodesInSelection(
      virtualDOM,
      range,
      contentRef.current
    );

    if (selectedVNodes.length === 0) {
      return; // No virtual nodes found in selection
    }

    // Create a formatting node
    const formattingNode = createFormattingNode(formatType);

    // Find the parent node of the first selected node
    const firstSelectedNode = selectedVNodes[0];
    const parent = firstSelectedNode.parent;

    if (!parent) {
      return; // No parent found
    }

    // Find the index of the first selected node in its parent's children
    const nodeIndex = parent.children.indexOf(firstSelectedNode);
    if (nodeIndex === -1) {
      return; // Node not found in parent's children
    }

    // Remove the selected nodes from their parent
    const nodesToRemove = [...selectedVNodes];
    nodesToRemove.forEach(node => {
      const nodeParent = node.parent;
      if (nodeParent) {
        const index = nodeParent.children.indexOf(node);
        if (index !== -1) {
          nodeParent.children.splice(index, 1);
          node.parent = null;
        }
      }
    });

    // Add the selected nodes as children of the formatting node
    nodesToRemove.forEach(node => {
      formattingNode.children.push(node);
      node.parent = formattingNode;
    });

    // Add the formatting node to the parent at the position of the first selected node
    parent.children.splice(nodeIndex, 0, formattingNode);
    formattingNode.parent = parent;

    // Update the real DOM with the modified virtual DOM
    const updatedHtml = HtmlCodec.encode(virtualDOM);

    // Update the content
    if (contentRef.current) {
      contentRef.current.innerHTML = updatedHtml;
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
