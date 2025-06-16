import { describe, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RichTextEditor, { RichTextEditorRef } from './RichTextEditor';
import { ZERO_WIDTH_SPACE } from '@/lib/components/cams/RichTextEditor/editor.constants';

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

  test('renders with label and aria description', () => {
    render(
      <RichTextEditor id="test-editor" label="Test Label" ariaDescription="Test description" />,
    );
    expect(screen.getByLabelText('Test Label')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  test('calls onChange when input changes', async () => {
    const onChange = vi.fn();
    render(<RichTextEditor id="test-editor" onChange={onChange} />);
    const editable = screen.getByRole('textbox');
    await userEvent.type(editable, 'hello');
    expect(onChange).toHaveBeenCalled();
  });

  test('calls Editor.handleCtrlKey on keydown and stops if handled', async () => {
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

  test('calls Editor.handleDentures and onChange on Tab', async () => {
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

  test.skip('calls Editor.handleEnterKey on Enter', async () => {
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

  test.skip('calls Editor.handleDeleteKeyOnList on Backspace', async () => {
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

  test('calls Editor.toggleSelection when toolbar buttons are clicked', async () => {
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

  test('calls Editor.toggleList and onChange when list buttons are clicked', async () => {
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

  test('exposes imperative methods via ref', async () => {
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
    // After clearValue, the editor is re-initialized with an empty paragraph containing a zero-width space
    expect(editable.innerHTML).toContain('<p>');
    // disable
    ref.current!.disable(true);
    expect(editable.getAttribute('contenteditable')).toBe('true');
    // focus
    const focusSpy = vi.spyOn(editable, 'focus');
    ref.current!.focus();
    expect(focusSpy).toHaveBeenCalled();
  });

  test('should return content with no zero-width spaces and no empty tags', () => {
    const ref = React.createRef<RichTextEditorRef>();
    render(<RichTextEditor id="test-editor" ref={ref} />);
    ref.current!.setValue(`<p>foo${ZERO_WIDTH_SPACE}</p><p><br></p>`);
    expect(ref.current!.getHtml()).toEqual('<p>foo</p>');
  });

  // describe('Editor: getHtml integration with RichTextEditor', () => {
  //   test('RichTextEditor.getHtml() returns empty string for initialized empty editor', () => {
  //     const container = document.createElement('div');
  //     document.body.appendChild(container);

  //     const editor = new Editor(container);

  //     expect(editor.isEmptyContent()).toBe(true);
  //     expect(container.innerHTML).toContain(`<p>${ZERO_WIDTH_SPACE}</p>`);
  //     document.body.removeChild(container);
  //   });

  //   test('RichTextEditor.getHtml() returns actual content when editor has real content', () => {
  //     const container = document.createElement('div');
  //     document.body.appendChild(container);

  //     const editor = new Editor(container);

  //     container.innerHTML = '<p>Hello world</p>';

  //     // Simulate RichTextEditor's getHtml method
  //     const rawHtml = container.innerHTML;
  //     const cleanedHtml = Editor.cleanZeroWidthSpaces(rawHtml);

  //     // The editor should not be empty
  //     expect(editor.isEmptyContent()).toBe(false);

  //     // getHtml should return the actual content
  //     const finalHtml = editor.isEmptyContent() ? '' : cleanedHtml;
  //     expect(finalHtml).toBe('<p>Hello world</p>');

  //     document.body.removeChild(container);
  //   });
  // });
});
