import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import RichTextEditor2, { type RichTextEditor2Ref } from './RichTextEditor2';
import { createRef } from 'react';

// Based on DECISION-009, empty paragraphs contain a zero-width space.
const ZERO_WIDTH_SPACE = '\u200B';
const EMPTY_EDITOR_HTML = `<p data-id="initial-p">${ZERO_WIDTH_SPACE}</p>`;

describe('RichTextEditor2', () => {
  const defaultProps = {
    id: 'test-editor',
    label: 'Test Editor',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders with basic props and initial empty state', () => {
    render(<RichTextEditor2 {...defaultProps} />);

    expect(screen.getByLabelText('Test Editor')).toBeInTheDocument();
    const editor = screen.getByRole('textbox');
    expect(editor).toBeInTheDocument();
    expect(editor.innerHTML).toBe(EMPTY_EDITOR_HTML);
  });

  const fireBeforeInput = (element: HTMLElement, inputType: string, data?: string) => {
    const event = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType,
      data,
    });
    // Manually prevent the default action, which userEvent.type() was not respecting.
    event.preventDefault();
    fireEvent(element, event);
  };

  test('handles text input via onBeforeInput', async () => {
    render(<RichTextEditor2 {...defaultProps} />);
    const editor = screen.getByRole('textbox');

    await act(async () => {
      fireBeforeInput(editor, 'insertText', 't');
      fireBeforeInput(editor, 'insertText', 'e');
      fireBeforeInput(editor, 'insertText', 's');
      fireBeforeInput(editor, 'insertText', 't');
    });

    await waitFor(() => {
      const p = editor.querySelector('p');
      expect(p?.textContent).toBe(`${ZERO_WIDTH_SPACE}test`);
    });
  });

  test('handles backspace to delete text', async () => {
    render(<RichTextEditor2 {...defaultProps} />);
    const editor = screen.getByRole('textbox');

    await act(async () => {
      fireBeforeInput(editor, 'insertText', 'a');
      fireBeforeInput(editor, 'insertText', 'b');
      fireBeforeInput(editor, 'insertText', 'c');
    });

    await act(async () => {
      fireBeforeInput(editor, 'deleteContentBackward');
    });

    await waitFor(() => {
      const p = editor.querySelector('p');
      expect(p?.textContent).toBe(`${ZERO_WIDTH_SPACE}ab`);
    });
  });

  test('ref methods exist', () => {
    const ref = createRef<RichTextEditor2Ref>();
    render(<RichTextEditor2 {...defaultProps} ref={ref} />);

    expect(ref.current).toBeDefined();
    expect(typeof ref.current?.clearValue).toBe('function');
    expect(typeof ref.current?.getHtml).toBe('function');
    expect(typeof ref.current?.setValue).toBe('function');
    expect(typeof ref.current?.disable).toBe('function');
    expect(typeof ref.current?.focus).toBe('function');
  });

  test('setValue updates content and getHtml returns it', async () => {
    const ref = createRef<RichTextEditor2Ref>();
    render(<RichTextEditor2 {...defaultProps} ref={ref} />);
    const editor = screen.getByRole('textbox');

    const newContent = '<p>Hello <strong>World</strong></p>';
    act(() => {
      ref.current?.setValue(newContent);
    });

    await waitFor(() => {
      // Note: data-id will be injected by the codec
      expect(editor.innerHTML).toContain('Hello');
      expect(editor.innerHTML).toContain('World');
      expect(editor.querySelector('strong')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(ref.current?.getHtml()).toContain('Hello');
    });
  });

  test('clearValue empties content to the initial state', async () => {
    const onChange = vi.fn();
    const ref = createRef<RichTextEditor2Ref>();
    render(<RichTextEditor2 {...defaultProps} ref={ref} onChange={onChange} />);
    const editor = screen.getByRole('textbox');

    act(() => {
      ref.current?.setValue('<p>Some content</p>');
    });
    await waitFor(() => expect(editor.innerHTML).not.toBe(EMPTY_EDITOR_HTML));

    act(() => {
      ref.current?.clearValue();
    });

    await waitFor(() => {
      expect(editor.innerHTML).toBe(EMPTY_EDITOR_HTML);
    });
    expect(onChange).toHaveBeenLastCalledWith(EMPTY_EDITOR_HTML);
  });

  test('disable/enable functionality works', async () => {
    const ref = createRef<RichTextEditor2Ref>();
    render(<RichTextEditor2 {...defaultProps} ref={ref} />);

    const editor = screen.getByRole('textbox');
    expect(editor).toHaveAttribute('contenteditable', 'true');

    act(() => {
      ref.current?.disable(true);
    });
    await waitFor(() => {
      expect(editor).toHaveAttribute('contenteditable', 'false');
    });

    act(() => {
      ref.current?.disable(false);
    });
    await waitFor(() => {
      expect(editor).toHaveAttribute('contenteditable', 'true');
    });
  });

  test('focus method works', () => {
    const ref = createRef<RichTextEditor2Ref>();
    render(<RichTextEditor2 {...defaultProps} ref={ref} />);
    const editor = screen.getByRole('textbox');

    act(() => {
      ref.current?.focus();
    });

    expect(editor).toHaveFocus();
  });
});
