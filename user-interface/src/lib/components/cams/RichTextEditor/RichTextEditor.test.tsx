import { describe, expect, beforeEach, vi, beforeAll } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RichTextEditor, { RichTextEditorRef } from './RichTextEditor';
import { ZERO_WIDTH_SPACE } from '@/lib/components/cams/RichTextEditor/editor.constants';

describe('RichTextEditor', () => {
  let Editor: {
    prototype: {
      handleBackspaceOnEmptyContent: (e: unknown) => boolean;
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
        handleBackspaceOnEmptyContent: (e: unknown) => boolean;
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

  test('handles Enter key in handleKeyDown', () => {
    // Create a mock implementation of handleEnterKey that returns true
    const handleEnterKey = vi.fn().mockReturnValue(true);

    // Mock all other methods to return false
    const handleCtrlKey = vi.fn().mockReturnValue(false);
    const handleBackspaceOnEmptyContent = vi.fn().mockReturnValue(false);
    const handleDentures = vi.fn().mockReturnValue(false);
    const handleDeleteKeyOnList = vi.fn().mockReturnValue(false);
    const handlePrintableKey = vi.fn().mockReturnValue(false);

    // Apply the mocks to the Editor prototype
    vi.spyOn(Editor.prototype, 'handleCtrlKey').mockImplementation(handleCtrlKey);
    vi.spyOn(Editor.prototype, 'handleBackspaceOnEmptyContent').mockImplementation(
      handleBackspaceOnEmptyContent,
    );
    vi.spyOn(Editor.prototype, 'handleDentures').mockImplementation(handleDentures);
    vi.spyOn(Editor.prototype, 'handleEnterKey').mockImplementation(handleEnterKey);
    vi.spyOn(Editor.prototype, 'handleDeleteKeyOnList').mockImplementation(handleDeleteKeyOnList);
    vi.spyOn(Editor.prototype, 'handlePrintableKey').mockImplementation(handlePrintableKey);

    // Render the component
    render(<RichTextEditor id="test-editor" />);

    // Get the editable element
    const editable = screen.getByRole('textbox');

    // Create a keydown event for Enter
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });

    // Dispatch the event
    editable.dispatchEvent(enterEvent);

    // Verify handleEnterKey was called
    expect(handleEnterKey).toHaveBeenCalled();

    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('handles Backspace key in handleKeyDown for lists', () => {
    // Create a mock implementation of handleDeleteKeyOnList that returns true
    const handleDeleteKeyOnList = vi.fn().mockReturnValue(true);

    // Mock all other methods to return false
    const handleCtrlKey = vi.fn().mockReturnValue(false);
    const handleBackspaceOnEmptyContent = vi.fn().mockReturnValue(false);
    const handleDentures = vi.fn().mockReturnValue(false);
    const handleEnterKey = vi.fn().mockReturnValue(false);
    const handlePrintableKey = vi.fn().mockReturnValue(false);

    // Apply the mocks to the Editor prototype
    vi.spyOn(Editor.prototype, 'handleCtrlKey').mockImplementation(handleCtrlKey);
    vi.spyOn(Editor.prototype, 'handleBackspaceOnEmptyContent').mockImplementation(
      handleBackspaceOnEmptyContent,
    );
    vi.spyOn(Editor.prototype, 'handleDentures').mockImplementation(handleDentures);
    vi.spyOn(Editor.prototype, 'handleEnterKey').mockImplementation(handleEnterKey);
    vi.spyOn(Editor.prototype, 'handleDeleteKeyOnList').mockImplementation(handleDeleteKeyOnList);
    vi.spyOn(Editor.prototype, 'handlePrintableKey').mockImplementation(handlePrintableKey);

    // Render the component
    render(<RichTextEditor id="test-editor" />);

    // Get the editable element
    const editable = screen.getByRole('textbox');

    // Create a keydown event for Backspace
    const backspaceEvent = new KeyboardEvent('keydown', {
      key: 'Backspace',
      bubbles: true,
      cancelable: true,
    });

    // Dispatch the event
    editable.dispatchEvent(backspaceEvent);

    // Verify handleDeleteKeyOnList was called
    expect(handleDeleteKeyOnList).toHaveBeenCalled();

    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('handles Backspace key on empty content', () => {
    // Create a mock implementation of handleBackspaceOnEmptyContent that returns true
    const handleBackspaceOnEmptyContent = vi.fn().mockReturnValue(true);

    // Mock all other methods to return false
    const handleCtrlKey = vi.fn().mockReturnValue(false);
    const handleDentures = vi.fn().mockReturnValue(false);
    const handleEnterKey = vi.fn().mockReturnValue(false);
    const handleDeleteKeyOnList = vi.fn().mockReturnValue(false);
    const handlePrintableKey = vi.fn().mockReturnValue(false);

    // Apply the mocks to the Editor prototype
    vi.spyOn(Editor.prototype, 'handleCtrlKey').mockImplementation(handleCtrlKey);
    vi.spyOn(Editor.prototype, 'handleBackspaceOnEmptyContent').mockImplementation(
      handleBackspaceOnEmptyContent,
    );
    vi.spyOn(Editor.prototype, 'handleDentures').mockImplementation(handleDentures);
    vi.spyOn(Editor.prototype, 'handleEnterKey').mockImplementation(handleEnterKey);
    vi.spyOn(Editor.prototype, 'handleDeleteKeyOnList').mockImplementation(handleDeleteKeyOnList);
    vi.spyOn(Editor.prototype, 'handlePrintableKey').mockImplementation(handlePrintableKey);

    // Render the component
    render(<RichTextEditor id="test-editor" />);

    // Get the editable element
    const editable = screen.getByRole('textbox');

    // Create a keydown event for Backspace
    const backspaceEvent = new KeyboardEvent('keydown', {
      key: 'Backspace',
      bubbles: true,
      cancelable: true,
    });

    // Dispatch the event
    editable.dispatchEvent(backspaceEvent);

    // Verify handleBackspaceOnEmptyContent was called
    expect(handleBackspaceOnEmptyContent).toHaveBeenCalled();

    // Restore all mocks
    vi.restoreAllMocks();
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

  test('getHtml returns empty string when editor is empty', () => {
    const ref = React.createRef<RichTextEditorRef>();
    render(<RichTextEditor id="test-editor" ref={ref} />);
    expect(ref.current!.getHtml()).toBe('');
  });

  test('disable sets inputDisabled', async () => {
    const ref = React.createRef<RichTextEditorRef>();
    render(<RichTextEditor id="test-editor" ref={ref} />);
    ref.current!.disable(true);
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveAttribute('contenteditable', 'false');
    });
  });

  test('focus calls focus on the contenteditable div', () => {
    const ref = React.createRef<RichTextEditorRef>();
    render(<RichTextEditor id="test-editor" ref={ref} />);
    const editable = screen.getByRole('textbox');
    const focusSpy = vi.spyOn(editable, 'focus');
    ref.current!.focus();
    expect(focusSpy).toHaveBeenCalled();
  });
});
