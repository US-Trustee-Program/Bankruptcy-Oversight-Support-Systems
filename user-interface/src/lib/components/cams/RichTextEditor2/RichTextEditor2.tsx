import './RichTextEditor2.scss';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StateMachineProvider, useStateMachine } from './StateMachineContext';
import { EditorEvent } from './StateMachine';
import { VirtualDOMTree } from './virtual-dom/VirtualDOMTree';
import { VNode } from './virtual-dom/VNode';
import { createTextNode } from './virtual-dom/VNodeFactory';
import { insertNode, removeNode } from './virtual-dom/VirtualDOMOperations';
import { HtmlCodec } from './virtual-dom/HtmlCodec';
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
        case 'i':
        case 'u':
          e.preventDefault();
          dispatch(EditorEvent.KEYBOARD_SHORTCUT);
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
