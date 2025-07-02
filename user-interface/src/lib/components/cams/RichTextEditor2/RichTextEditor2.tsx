import './RichTextEditor2.scss';
import * as React from 'react';
import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { EditorState, SelectionState } from './types';
import { insertText, deleteContentBackward } from './mutations/textMutations';
import { VNodeType, RootNode, ElementNode, TextNode, VNode, isTextNode } from './virtual-dom/VNode';
import { HtmlCodec } from './virtual-dom/HtmlCodec';

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

const ZERO_WIDTH_SPACE = '\u200B';

const createInitialState = (): EditorState => {
  const textNode: TextNode = {
    id: 'initial-text',
    type: VNodeType.TEXT,
    parent: null,
    children: [],
    startOffset: 1,
    endOffset: 1,
    depth: 2,
    content: ZERO_WIDTH_SPACE,
  };
  const pNode: ElementNode = {
    id: 'initial-p',
    type: VNodeType.ELEMENT,
    tagName: 'p',
    attributes: {},
    parent: null,
    children: [textNode],
    startOffset: 0,
    endOffset: 1,
    depth: 1,
  };
  textNode.parent = pNode;
  const rootNode: RootNode = {
    id: 'root',
    type: VNodeType.ROOT,
    parent: null,
    children: [pNode],
    startOffset: 0,
    endOffset: 1,
    depth: 0,
  };
  pNode.parent = rootNode;
  return {
    vdom: rootNode,
    selection: {
      anchorNode: textNode,
      anchorOffset: 1,
      focusNode: textNode,
      focusOffset: 1,
      isCollapsed: true,
    },
  };
};

const RichTextEditor2 = forwardRef<RichTextEditor2Ref, RichTextEditor2Props>(
  ({ id, label, ariaDescription, onChange, disabled, required, className }, ref) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [editorState, setEditorState] = useState<EditorState>(createInitialState());
    const [inputDisabled, setInputDisabled] = useState<boolean>(disabled || false);

    useEffect(() => {
      // Component mounted - editor is ready
    }, []);

    // VDOM -> DOM Rendering & Selection Synchronization Effect
    useEffect(() => {
      const contentDiv = contentRef.current;
      if (!contentDiv) return;

      // 1. Render VDOM to DOM
      const html = HtmlCodec.encode(editorState.vdom);
      if (html !== contentDiv.innerHTML) {
        contentDiv.innerHTML = html;
      }

      // 2. Synchronize Selection
      const { selection } = editorState;
      if (!selection) return;

      const vdomToDomPosition = (
        vnode: VNode,
        vdomOffset: number,
      ): { node: Node; offset: number } | null => {
        if (!isTextNode(vnode)) {
          // For now, only handle text node selections.
          // A more robust implementation would find the nearest text node.
          return null;
        }

        // We need to find the DOM element corresponding to the VNode's *parent*.
        const vdomParent = vnode.parent;
        if (!vdomParent) return null;

        const domParent = contentDiv.querySelector(`[data-id="${vdomParent.id}"]`);
        if (!domParent) return null;

        // Now, within that parent, find the correct text node child.
        // This is tricky because of how the browser might merge or split text nodes.
        let textNodeIndex = 0;
        let found = false;
        for (const child of vdomParent.children) {
          if (child.id === vnode.id) {
            found = true;
            break;
          }
          if (isTextNode(child)) {
            textNodeIndex++;
          }
        }

        if (!found) return null;

        // Walk the DOM to find the nth text node within the parent.
        const walker = document.createTreeWalker(domParent, NodeFilter.SHOW_TEXT);
        let domNode: Node | null;
        let currentIndex = 0;
        while ((domNode = walker.nextNode())) {
          if (currentIndex === textNodeIndex) {
            // Found the corresponding DOM text node.
            // The browser might have split a single Text VNode into multiple DOM text nodes.
            // We need to normalize them to correctly set the offset.
            while (domNode.nextSibling && domNode.nextSibling.nodeType === Node.TEXT_NODE) {
              const next = domNode.nextSibling;
              domNode.textContent = (domNode.textContent ?? '') + (next.textContent ?? '');
              next.parentNode?.removeChild(next);
            }
            return { node: domNode, offset: vdomOffset };
          }
          currentIndex++;
        }
        return null; // Should not happen if VDOM and DOM are in sync
      };

      const anchorPosition = vdomToDomPosition(selection.anchorNode, selection.anchorOffset);
      const focusPosition = vdomToDomPosition(selection.focusNode, selection.focusOffset);

      if (anchorPosition && focusPosition) {
        const domSelection = window.getSelection();
        if (domSelection) {
          const range = document.createRange();
          range.setStart(anchorPosition.node, anchorPosition.offset);
          range.setEnd(focusPosition.node, focusPosition.offset);
          domSelection.removeAllRanges();
          domSelection.addRange(range);
        }
      }

      // 3. Fire onChange
      if (onChange) {
        onChange(HtmlCodec.encode(editorState.vdom));
      }
    }, [editorState, onChange]);

    const handleBeforeInput = (event: React.FormEvent<HTMLDivElement>) => {
      event.preventDefault();
      const inputEvent = event.nativeEvent as InputEvent;

      setEditorState((currentEditorState) => {
        let newState: EditorState | null = null;

        switch (inputEvent.inputType) {
          case 'insertText':
            if (inputEvent.data) {
              newState = insertText(currentEditorState, inputEvent.data);
            }
            break;
          case 'deleteContentBackward':
            newState = deleteContentBackward(currentEditorState);
            break;
        }

        return newState || currentEditorState;
      });
    };

    useImperativeHandle(ref, () => ({
      clearValue: () => setEditorState(createInitialState()),
      getValue: () => HtmlCodec.encode(editorState.vdom), // Or a text representation
      getHtml: () => HtmlCodec.encode(editorState.vdom),
      setValue: (value: string) => {
        const newVdom = HtmlCodec.decode(value);
        // A simple text node selection might not exist after arbitrary HTML is set.
        // A more robust solution is needed for a future phase.
        const firstTextNode = findFirstTextNode(newVdom);
        const newSelection: SelectionState | null = firstTextNode
          ? {
              anchorNode: firstTextNode,
              anchorOffset: 0,
              focusNode: firstTextNode,
              focusOffset: 0,
              isCollapsed: true,
            }
          : createInitialState().selection; // Fallback to initial selection

        setEditorState({ vdom: newVdom, selection: newSelection });
      },
      disable: (value: boolean) => setInputDisabled(value),
      focus: () => contentRef.current?.focus(),
    }));

    function findFirstTextNode(node: VNode): TextNode | null {
      if (isTextNode(node)) return node;
      for (const child of node.children) {
        const found = findFirstTextNode(child);
        if (found) return found;
      }
      return null;
    }

    return (
      <div id={`${id}-container`} className="usa-form-group rich-text-editor-container">
        <label
          className={`usa-label ${!label && 'usa-sr-only'}`}
          id={`editor-label-${id}`}
          htmlFor={id}
        >
          {label || 'Rich text editor'}
        </label>
        <div className="editor-toolbar">{/* Toolbar will go here */}</div>
        <div
          id={id}
          ref={contentRef}
          className={`editor-content ${className || ''}`}
          contentEditable={!inputDisabled}
          role="textbox"
          tabIndex={0}
          aria-multiline="true"
          aria-labelledby={`editor-label-${id}`}
          aria-describedby={ariaDescription ? `${id}-description` : undefined}
          aria-required={required}
          onBeforeInput={handleBeforeInput}
          data-testid={id}
        ></div>
        {ariaDescription && (
          <div className="usa-hint" id={`${id}-description`}>
            {ariaDescription}
          </div>
        )}
      </div>
    );
  },
);

RichTextEditor2.displayName = 'RichTextEditor2';
export default RichTextEditor2;
