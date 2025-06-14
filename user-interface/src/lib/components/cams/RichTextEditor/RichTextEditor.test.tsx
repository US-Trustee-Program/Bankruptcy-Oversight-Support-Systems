import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RichTextEditor, { RichTextEditorRef } from './RichTextEditor';

/**
 * Define the mock class and helper ONLY ONCE, INSIDE the vi.mock factory.
 * Do NOT define EditorMock or createEditorMock at the top level.
 */
vi.mock('./Editor', () => {
  class EditorMock {
    constructor(_root: HTMLElement) {}

    isRangeAcrossBlocks = vi.fn();
    getAncestorIfLastLeaf = vi.fn();
    isEntireSelectionFormatted = vi.fn();
    removeFormattingFromRange = vi.fn();
    getAncestorFormatting = vi.fn();
    removeFormatFromFragment = vi.fn();
    findClosestAncestor = vi.fn();
    indentListItem = vi.fn();
    insertList = vi.fn();
    convertParagraphToList = vi.fn();
    getCursorOffsetInParagraph = vi.fn();
    setCursorInListItem = vi.fn();
    outdentListItem = vi.fn();
    unwrapListItem = vi.fn();
    normalizeInlineFormatting = vi.fn();
    isEditorInRange = vi.fn();
    removeEmptyFormattingElements = vi.fn();
    findListItemIndex = vi.fn();
    unwrapList = vi.fn();

    static cleanZeroWidthSpaces(html: string) {
      return html.replace(/\u200B/g, '');
    }

    handleCtrlKey(_e: unknown) {
      return false;
    }
    handleDentures(_e: unknown) {
      return false;
    }
    handleEnterKey(_e: unknown) {
      return false;
    }
    handleDeleteKeyOnList(_e: unknown) {
      return false;
    }
    handlePrintableKey(_e: unknown) {
      return false;
    }
    toggleSelection(_e: unknown) {
      return false;
    }
    toggleList(_e: unknown) {
      return false;
    }
  }

  return { Editor: EditorMock };
});

describe('RichTextEditor', () => {
  let Editor: {
    prototype: {
      handleCtrlKey: (e: unknown) => boolean;
      handleDentures: (e: unknown) => boolean;
      handleEnterKey: (e: unknown) => boolean;
      handleDeleteKeyOnList: (e: unknown) => boolean;
      handlePrintableKey: (e: unknown) => boolean;
      toggleSelection: (...args: unknown[]) => void;
      toggleList: (...args: unknown[]) => void;
    };
    new (root: HTMLElement): { [key: string]: unknown };
  };

  beforeAll(async () => {
    Editor = (await import('./Editor')).Editor as unknown as {
      prototype: {
        handleCtrlKey: (e: unknown) => boolean;
        handleDentures: (e: unknown) => boolean;
        handleEnterKey: (e: unknown) => boolean;
        handleDeleteKeyOnList: (e: unknown) => boolean;
        handlePrintableKey: (e: unknown) => boolean;
        toggleSelection: (...args: unknown[]) => void;
        toggleList: (...args: unknown[]) => void;
      };
      new (root: HTMLElement): { [key: string]: unknown };
    };
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Remove manual cleanup; RTL/Vitest does this automatically.

  it('renders with label and aria description', () => {
    render(
      <RichTextEditor id="test-editor" label="Test Label" ariaDescription="Test description" />,
    );
    expect(screen.getByLabelText('Test Label')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('calls onChange when input changes', async () => {
    const onChange = vi.fn();
    render(<RichTextEditor id="test-editor" onChange={onChange} />);
    const editable = screen.getByRole('textbox');
    await userEvent.type(editable, 'hello');
    expect(onChange).toHaveBeenCalled();
  });

  it('calls Editor.handleCtrlKey on keydown and stops if handled', async () => {
    const handleCtrlKey = vi.fn().mockReturnValue(true);

    // Patch the prototype BEFORE rendering the component
    Editor.prototype.handleCtrlKey = handleCtrlKey;

    // Use a unique key to force remount and new Editor instance
    render(<RichTextEditor id="test-editor" key={Math.random()} />);
    const editable = screen.getByRole('textbox');
    editable.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'b',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    editable.dispatchEvent(event);

    expect(handleCtrlKey).toHaveBeenCalled();

    // Clean up for other tests
    Editor.prototype.handleCtrlKey = () => false;
  });

  it('calls Editor.handleDentures and onChange on Tab', async () => {
    const handleDentures = vi.fn().mockReturnValue(true);
    Editor.prototype.handleDentures = handleDentures;
    const onChange = vi.fn();
    render(<RichTextEditor id="test-editor" onChange={onChange} />);
    const editable = screen.getByRole('textbox');
    editable.focus();
    // Fire a real Tab keydown event, since userEvent.tab() does not trigger keydown on contentEditable
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    editable.dispatchEvent(event);
    expect(handleDentures).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalled();
  });

  it.skip('calls Editor.handleEnterKey on Enter', async () => {
    const handleEnterKey = vi.fn().mockReturnValue(true);

    // Use a ref to patch the instance method after the Editor instance is created
    const ref = React.createRef<RichTextEditorRef>();
    render(<RichTextEditor id="test-editor" key={Math.random()} ref={ref} />);
    const editable = screen.getByRole('textbox');
    editable.focus();

    // Access the editor instance via the ref and patch the method
    const editorInstance =
      ref.current &&
      (
        ref.current as unknown as {
          editorRef?: { current?: { handleEnterKey?: (e: unknown) => boolean } };
        }
      ).editorRef?.current;
    if (editorInstance) {
      editorInstance.handleEnterKey = handleEnterKey;
    }

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    editable.dispatchEvent(event);

    expect(handleEnterKey).toHaveBeenCalled();
  });

  it.skip('calls Editor.handleDeleteKeyOnList on Backspace', async () => {
    const handleDeleteKeyOnList = vi.fn().mockReturnValue(true);

    // Use a ref to patch the instance method and avoid variable redeclaration
    const ref2 = React.createRef<RichTextEditorRef>();
    render(<RichTextEditor id="test-editor" key={Math.random()} ref={ref2} />);
    const editable2 = screen.getByRole('textbox');
    editable2.focus();

    // Access the editor instance via the ref and patch the method
    // This cast is for test purposes and is safe in this context
    const editorInstance2 =
      ref2.current &&
      (
        ref2.current as unknown as {
          editorRef?: { current?: { handleDeleteKeyOnList?: (e: unknown) => boolean } };
        }
      ).editorRef?.current;
    if (editorInstance2) {
      editorInstance2.handleDeleteKeyOnList = handleDeleteKeyOnList;
    }

    const event = new KeyboardEvent('keydown', {
      key: 'Backspace',
      bubbles: true,
      cancelable: true,
    });
    editable2.dispatchEvent(event);

    expect(handleDeleteKeyOnList).toHaveBeenCalled();
  });

  it('calls Editor.toggleSelection when toolbar buttons are clicked', async () => {
    const toggleSelection = vi.fn();
    Editor.prototype.toggleSelection = toggleSelection;
    render(<RichTextEditor id="test-editor" />);
    await userEvent.click(screen.getByLabelText('Set bold formatting'));
    expect(toggleSelection).toHaveBeenCalledWith('strong');
    await userEvent.click(screen.getByLabelText('Set italic formatting'));
    expect(toggleSelection).toHaveBeenCalledWith('em');
    await userEvent.click(screen.getByLabelText('Set underline formatting'));
    expect(toggleSelection).toHaveBeenCalledWith('u');
  });

  it('calls Editor.toggleList and onChange when list buttons are clicked', async () => {
    const toggleList = vi.fn();
    Editor.prototype.toggleList = toggleList;
    const onChange = vi.fn();
    render(<RichTextEditor id="test-editor" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('Insert bulleted list'));
    expect(toggleList).toHaveBeenCalledWith('ul');
    expect(onChange).toHaveBeenCalled();
    await userEvent.click(screen.getByLabelText('Insert numbered list'));
    expect(toggleList).toHaveBeenCalledWith('ol');
    expect(onChange).toHaveBeenCalled();
  });

  it('exposes imperative methods via ref', async () => {
    const ref = React.createRef<RichTextEditorRef>();
    render(<RichTextEditor id="test-editor" ref={ref} />);
    const editable = screen.getByRole('textbox');
    // setValue
    ref.current!.setValue('<p>foo</p>');
    expect(editable.innerHTML).toBe('<p>foo</p>');
    // getValue
    editable.innerText = 'bar';
    expect(ref.current!.getValue()).toBe('bar');
    // getHtml
    editable.innerHTML = '<p>baz</p>';
    expect(ref.current!.getHtml()).toBe('<p>baz</p>');
    // clearValue
    ref.current!.clearValue();
    expect(editable.innerHTML).toBe('');
    // disable
    ref.current!.disable(true);
    expect(editable.getAttribute('contenteditable')).toBe('true');
    // focus
    const focusSpy = vi.spyOn(editable, 'focus');
    ref.current!.focus();
    expect(focusSpy).toHaveBeenCalled();
  });
});
