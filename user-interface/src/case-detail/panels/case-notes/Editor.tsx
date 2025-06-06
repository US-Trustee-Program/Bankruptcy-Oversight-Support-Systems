import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import './Editor.scss';
import Button from '@/lib/components/uswds/Button';

export function normalizeContentEditableRoot(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (node.parentNode === root && node.textContent?.trim()) {
      const p = document.createElement('p');
      node.replaceWith(p);
      p.appendChild(node);
    }
  }
}

function stripFormatting(node: Node) {
  if (!(node instanceof HTMLElement)) {
    return;
  }

  const inlineTags = ['strong', 'b', 'em', 'i', 'u', 'span', 'font'];

  inlineTags.forEach((tag) => {
    node.querySelectorAll(tag).forEach((el) => {
      while (el.firstChild) {
        el.parentNode?.insertBefore(el.firstChild, el);
      }
      el.remove();
    });
  });
}

export interface EditorRef {
  clearValue: () => void;
  getValue: () => string;
  getHtml: () => string;
  setValue: (value: string) => void;
  disable: (value: boolean) => void;
  focus: () => void;
}

export interface EditorProps {
  id: string;
  label?: string;
  ariaDescription?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

function _Editor(props: EditorProps, ref: React.Ref<EditorRef>) {
  const { id, label, ariaDescription, onChange, required, className, value, disabled } = props;

  const contentRef = useRef<HTMLDivElement>(null);
  const [inputDisabled, setInputDisabled] = useState<boolean>(disabled || false);

  useEffect(() => {
    setInputDisabled(disabled || false);
  }, [disabled]);

  useEffect(() => {
    if (value && contentRef.current) {
      contentRef.current.innerHTML = value;
    }
  }, [value]);

  const clearValue = () => {
    if (contentRef.current) {
      contentRef.current.innerHTML = '';
      onChange?.('');
    }
  };

  const getValue = () => contentRef.current?.innerText || '';
  const getHtml = () => contentRef.current?.innerHTML || '';
  const setValue = (html: string) => {
    if (contentRef.current) {
      contentRef.current.innerHTML = html;
    }
  };
  const disable = (val: boolean) => setInputDisabled(val);
  const focus = () => contentRef.current?.focus();

  useImperativeHandle(ref, () => ({
    clearValue,
    getValue,
    getHtml,
    setValue,
    disable,
    focus,
  }));

  function toggleSelection(tagName: 'strong' | 'em' | 'u') {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      return;
    }

    const commonAncestor = range.commonAncestorContainer;
    const wrapperElement = findClosest(commonAncestor, tagName);

    if (wrapperElement) {
      // Unwrap
      const parent = wrapperElement.parentNode;
      while (wrapperElement.firstChild) {
        parent?.insertBefore(wrapperElement.firstChild, wrapperElement);
      }
      parent?.removeChild(wrapperElement);
    } else {
      // Wrap
      const wrapper = document.createElement(tagName);
      wrapper.appendChild(range.extractContents());
      range.insertNode(wrapper);

      // Move selection after the inserted node
      range.setStartAfter(wrapper);
      range.setEndAfter(wrapper);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    onChange?.(getHtml());
  }

  const findClosest = (node: Node | null, selector: string): HTMLElement | null => {
    while (node) {
      if (node instanceof HTMLElement && node.matches(selector)) {
        return node;
      }
      node = node.parentNode!;
    }
    return null;
  };

  const insertList = (type: 'ul' | 'ol') => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0);
    const list = document.createElement(type);
    const li = document.createElement('li');
    const span = document.createElement('span');
    const cleanText = document.createTextNode('\u200B');

    span.appendChild(cleanText);
    li.appendChild(span);
    list.appendChild(li);

    // Insert new list block
    range.deleteContents();
    range.insertNode(list);

    // move the selection into the span
    const newRange = document.createRange();
    newRange.setStart(span.firstChild!, 1);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
  };

  const indentListItem = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    const li = node instanceof Element ? node.closest?.('li') : node.parentElement?.closest('li');
    if (!li) {
      return;
    }

    const parentList = li.parentElement;
    if (!parentList) {
      return;
    }

    const prevLi = li.previousElementSibling;
    if (!prevLi || prevLi.tagName !== 'LI') {
      return;
    }

    let nestedList = prevLi.querySelector('ul, ol');
    if (!nestedList) {
      nestedList = document.createElement(parentList.tagName.toLowerCase());
      prevLi.appendChild(nestedList);
    }

    nestedList.appendChild(li);
  };

  const outdentListItem = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    const li = node instanceof Element ? node.closest?.('li') : node.parentElement?.closest('li');
    if (!li) {
      return;
    }

    const parentList = li.parentElement;
    const grandparentLi = parentList?.parentElement?.closest?.('li');

    if (parentList && grandparentLi) {
      grandparentLi.parentElement?.insertBefore(li, grandparentLi.nextSibling);

      // Clean up empty lists
      if (parentList.children.length === 0) {
        parentList.remove();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey && !e.shiftKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          toggleSelection('strong');
          break;
        case 'i':
          e.preventDefault();
          toggleSelection('em');
          break;
        case 'u':
          e.preventDefault();
          toggleSelection('u');
          break;
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        outdentListItem();
      } else {
        indentListItem();
      }
      onChange?.(getHtml());
    } else if (e.key === 'Enter') {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) {
        return;
      }

      const range = selection.getRangeAt(0);
      const li =
        range?.startContainer instanceof Element
          ? range.startContainer.closest('li')
          : range?.startContainer.parentElement?.closest('li');

      if (li) {
        // Inside a list item — allow native behavior
        const isEmpty = li.textContent?.trim() === '';
        if (isEmpty) {
          e.preventDefault();

          // Exit list: insert new paragraph after list
          const p = document.createElement('p');
          stripFormatting(p);
          const span = document.createElement('span');
          span.textContent = '\u200B';
          p.appendChild(span);

          const list = li.closest('ul') || li.closest('ol');
          list?.parentNode?.insertBefore(p, list.nextSibling);

          // Move selection into the new paragraph
          const newRange = document.createRange();
          newRange.setStart(span.firstChild!, 1);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);

          // Optionally remove the list if it has no meaningful content left
          if (list && [...list.children].every((child) => child.textContent?.trim() === '')) {
            list.remove();
          }

          return;
        }

        return;
      }

      // Remove formatting context
      e.preventDefault();
      const p = document.createElement('p');
      stripFormatting(p);
      const span = document.createElement('span');
      span.textContent = '\u200B';
      p.appendChild(span);

      range.deleteContents();
      range.insertNode(p);

      const newRange = document.createRange();
      newRange.setStart(span.firstChild!, 1);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  };

  return (
    <div className="usa-form-group editor-container">
      {label && (
        <label
          htmlFor={id}
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

      <div className="editor-formatting-buttons">
        <Button onClick={() => toggleSelection('strong')} title="Bold (Ctrl+B)">
          B
        </Button>
        <Button onClick={() => toggleSelection('em')} title="Italic (Ctrl+I)">
          I
        </Button>
        <Button onClick={() => toggleSelection('u')} title="Underline (Ctrl+U)">
          U
        </Button>
        <Button
          onClick={() => {
            insertList('ul');
            onChange?.(getHtml());
          }}
          title="Bulleted List"
        >
          •
        </Button>
        <Button
          onClick={() => {
            insertList('ol');
            onChange?.(getHtml());
          }}
          title="Numbered List"
        >
          1.
        </Button>
      </div>
      <div
        id={id}
        className={`editor-content ${className || ''}`}
        contentEditable={!inputDisabled}
        tabIndex={0}
        onInput={() => onChange?.(getHtml())}
        onKeyDown={handleKeyDown}
        ref={contentRef}
        aria-describedby={ariaDescription ? `editor-hint-${id}` : undefined}
        role="textbox"
        aria-multiline="true"
        suppressContentEditableWarning
        style={{
          minHeight: '150px',
          border: '1px solid #ccc',
          padding: '1rem',
        }}
      />
    </div>
  );
}

const Editor = forwardRef(_Editor);
export default Editor;
