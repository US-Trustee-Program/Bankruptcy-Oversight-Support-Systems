import { describe, expect, beforeEach, vi, test } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RichTextEditor, { RichTextEditorRef } from './RichTextEditor';
import {
  createMockEditor,
  resetMockEditor,
  MockEditor,
  FORMATTING_BUTTONS,
  LIST_BUTTONS,
} from '../../../testing/mock-editor';

// Create a mock function outside the factory
const mockUseEditor = vi.fn();

// Create mockEditor using the factory
let mockEditor: MockEditor;

interface EditorContentProps {
  editor?: MockEditor;
  className?: string;
  'aria-labelledby'?: string;
}

vi.mock('@tiptap/react', () => ({
  useEditor: (...args: unknown[]) => mockUseEditor(...args),
  EditorContent: ({ editor, className, 'aria-labelledby': ariaLabelledBy }: EditorContentProps) => (
    <div
      data-testid="editor-content"
      className={className || ''}
      contentEditable={editor?.isEditable}
      aria-labelledby={ariaLabelledBy}
      onInput={(_e: React.FormEvent) => editor?.onUpdate?.({ editor })}
    >
      {editor?.getHTML?.() || ''}
    </div>
  ),
}));

vi.mock('@tiptap/starter-kit', () => ({
  default: 'StarterKit',
}));

// Mock the useOutsideClick hook
const mockUseOutsideClick = vi.fn();
vi.mock('@/lib/hooks/UseOutsideClick', () => ({
  default: (...args: unknown[]) => mockUseOutsideClick(...args),
}));

describe('RichTextEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditor = createMockEditor();
    resetMockEditor(mockEditor);
    mockUseOutsideClick.mockReset();
    mockUseEditor.mockReturnValue(mockEditor);
  });

  test('renders with label, aria description, and className', () => {
    render(
      <RichTextEditor
        id="test-editor"
        label="Test Label"
        ariaDescription="Test description"
        className="test-class"
      />,
    );

    expect(screen.getByText('Test Label')).not.toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByLabelText('Test Label')).toBeInTheDocument();
    expect(screen.getByTestId('editor-label-test-editor')).toHaveClass('test-class-label');
  });

  test('renders without label and aria description', () => {
    render(<RichTextEditor id="test-editor" />);

    expect(screen.queryByText('Test Label')).not.toBeInTheDocument();
    expect(screen.queryByText('Test description')).not.toBeInTheDocument();
  });

  test('shows required indicator when required prop is true', () => {
    render(<RichTextEditor id="test-editor" label="Test Label" required={true} />);

    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(
      screen.getByText('Test Label').querySelector('.required-form-field'),
    ).toBeInTheDocument();
  });

  test('does not show required indicator when required prop is false', () => {
    render(<RichTextEditor id="test-editor" label="Test Label" required={false} />);

    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(
      screen.getByText('Test Label').querySelector('.required-form-field'),
    ).not.toBeInTheDocument();
  });

  test('calls onChange when editor content changes', async () => {
    const onChange = vi.fn();
    render(<RichTextEditor id="test-editor" onChange={onChange} />);
    const editorContent = screen.getByTestId('editor-content');
    await userEvent.type(editorContent, 'hello');
    // Simulate rich text editor's update event
    onChange('<p>test content</p>');
    expect(onChange).toHaveBeenCalled();
  });

  test('exposes imperative methods via ref', async () => {
    const ref = React.createRef<RichTextEditorRef>();
    render(<RichTextEditor id="test-editor" ref={ref} />);

    // Test setValue
    ref.current!.setValue('<p>test content</p>');
    expect(mockEditor.commands.setContent).toHaveBeenCalledWith('<p>test content</p>');

    // Test setValue with empty content
    ref.current!.setValue('');
    expect(mockEditor.commands.clearContent).toHaveBeenCalled();

    // Test getValue
    expect(ref.current!.getValue()).toBe('test content');
    expect(mockEditor.getText).toHaveBeenCalled();

    // Test getHtml
    expect(ref.current!.getHtml()).toBe('<p>test content</p>');
    expect(mockEditor.getHTML).toHaveBeenCalled();

    // Test clearValue
    ref.current!.clearValue();
    expect(mockEditor.commands.clearContent).toHaveBeenCalled();

    // Test disable
    ref.current!.disable(true);
    await waitFor(() => {
      expect(mockEditor.setEditable).toHaveBeenCalledWith(false);
    });
    ref.current!.disable(false);
    await waitFor(() => {
      expect(mockEditor.setEditable).toHaveBeenCalledWith(true);
    });

    // Test focus
    ref.current!.focus();
    expect(mockEditor.commands.focus).toHaveBeenCalled();
  });

  test('disable method updates editor editable state', async () => {
    const ref = React.createRef<RichTextEditorRef>();
    render(<RichTextEditor id="test-editor" ref={ref} />);

    ref.current!.disable(true);
    await waitFor(() => {
      expect(mockEditor.setEditable).toHaveBeenCalledWith(false);
    });

    ref.current!.disable(false);
    await waitFor(() => {
      expect(mockEditor.setEditable).toHaveBeenCalledWith(true);
    });
  });

  test('handles disabled state correctly', async () => {
    const ref = React.createRef<RichTextEditorRef>();
    const { rerender } = render(<RichTextEditor id="test-editor" ref={ref} disabled={true} />);
    // Simulate the effect of setEditable(false) on the mock
    mockEditor.isEditable = false;
    rerender(<RichTextEditor id="test-editor" ref={ref} disabled={true} />);
    const editorContent = screen.getByTestId('editor-content');
    expect(editorContent).toHaveAttribute('contenteditable', 'false');
    expect(editorContent).toHaveClass('disabled');
  });

  test('updates disabled state when prop changes', async () => {
    const ref = React.createRef<RichTextEditorRef>();
    const { rerender } = render(<RichTextEditor id="test-editor" ref={ref} disabled={false} />);
    // Simulate the effect of setEditable(true) on the mock
    mockEditor.isEditable = true;
    rerender(<RichTextEditor id="test-editor" ref={ref} disabled={false} />);
    const editorContent = screen.getByTestId('editor-content');
    expect(editorContent).toHaveAttribute('contenteditable', 'true');
    expect(editorContent).not.toHaveClass('disabled');
  });

  // Toolbar tests
  describe('Toolbar', () => {
    describe('Formatting buttons', () => {
      test('renders toolbar with formatting buttons', () => {
        render(<RichTextEditor id="test-editor" />);

        expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Italic' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Underline' })).toBeInTheDocument();
      });

      test.each(FORMATTING_BUTTONS)(
        '$name button calls $command when clicked',
        async ({ name }) => {
          const user = userEvent.setup();
          render(<RichTextEditor id="test-editor" />);

          const button = screen.getByRole('button', { name });
          await user.click(button);

          expect(mockEditor.chain).toHaveBeenCalled();
        },
      );

      test.each(FORMATTING_BUTTONS)(
        '$name button shows active state when $mark is active',
        ({ name, mark }) => {
          mockEditor.isActive = vi.fn((testMark: string) => testMark === mark);
          render(<RichTextEditor id="test-editor" />);

          const button = screen.getByRole('button', { name });
          expect(button).toHaveClass('is-active');
        },
      );

      test.each(FORMATTING_BUTTONS)(
        '$name button shows inactive state when $mark is not active',
        ({ name }) => {
          mockEditor.isActive = vi.fn(() => false);
          render(<RichTextEditor id="test-editor" />);

          const button = screen.getByRole('button', { name });
          expect(button).not.toHaveClass('is-active');
        },
      );

      test.each(FORMATTING_BUTTONS)(
        '$name button is disabled when editor is disabled',
        ({ name }) => {
          render(<RichTextEditor id="test-editor" disabled={true} />);

          const button = screen.getByRole('button', { name });
          expect(button).toBeDisabled();
        },
      );

      test.each(FORMATTING_BUTTONS)(
        '$name button is enabled when editor is enabled',
        ({ name }) => {
          render(<RichTextEditor id="test-editor" disabled={false} />);

          const button = screen.getByRole('button', { name });
          expect(button).not.toBeDisabled();
        },
      );

      test.each(FORMATTING_BUTTONS)('$name button has correct aria-label and title', ({ name }) => {
        render(<RichTextEditor id="test-editor" />);

        const button = screen.getByRole('button', { name });
        expect(button).toHaveAttribute('aria-label', name);
        expect(button).toHaveAttribute('title', name);
      });

      test.each(FORMATTING_BUTTONS)(
        '$name button displays correct text label',
        ({ name, display }) => {
          render(<RichTextEditor id="test-editor" />);

          const button = screen.getByRole('button', { name });
          expect(button).toHaveTextContent(display);
        },
      );
    });

    describe('List buttons', () => {
      test.each(LIST_BUTTONS)(
        '$name button is present and calls $command when clicked',
        async ({ name }) => {
          const user = userEvent.setup();
          render(<RichTextEditor id="test-editor" />);

          const button = screen.getByRole('button', { name: new RegExp(name, 'i') });
          expect(button).toBeInTheDocument();

          await user.click(button);
          expect(mockEditor.chain).toHaveBeenCalled();
        },
      );

      test.each(LIST_BUTTONS)(
        '$name button shows active state when $mark is active',
        ({ name, mark }) => {
          mockEditor.isActive = vi.fn((testMark: string) => testMark === mark);
          render(<RichTextEditor id="test-editor" />);

          const button = screen.getByRole('button', { name: new RegExp(name, 'i') });
          expect(button).toHaveClass('is-active');
        },
      );
    });
  });

  test('initializes editor with correct configuration', () => {
    render(<RichTextEditor id="test-editor" />);

    expect(mockUseEditor).toHaveBeenCalledWith({
      extensions: ['StarterKit', expect.any(Object), expect.any(Object)],
      content: '',
      immediatelyRender: true,
      editable: true,
      onUpdate: expect.any(Function),
    });
  });

  test('initializes editor with disabled state when disabled prop is true', () => {
    render(<RichTextEditor id="test-editor" disabled={true} />);

    expect(mockUseEditor).toHaveBeenCalledWith({
      extensions: ['StarterKit', expect.any(Object), expect.any(Object)],
      content: '',
      immediatelyRender: true,
      editable: false,
      onUpdate: expect.any(Function),
    });
  });

  test('calls onChange with HTML content when editor updates', () => {
    const onChange = vi.fn();
    render(<RichTextEditor id="test-editor" onChange={onChange} />);

    // Simulate editor update
    const onUpdate = mockUseEditor.mock.calls[0][0].onUpdate;
    onUpdate({ editor: mockEditor });

    expect(onChange).toHaveBeenCalledWith('<p>test content</p>');
  });

  test('handles empty content correctly', () => {
    mockEditor.getHTML.mockReturnValue('');
    mockEditor.getText.mockReturnValue('');

    const onChange = vi.fn();
    render(<RichTextEditor id="test-editor" onChange={onChange} />);

    const onUpdate = mockUseEditor.mock.calls[0][0].onUpdate;
    onUpdate({ editor: mockEditor });

    expect(onChange).toHaveBeenCalledWith('');
  });

  test('setValue handles empty string correctly', () => {
    const ref = React.createRef<RichTextEditorRef>();
    render(<RichTextEditor id="test-editor" ref={ref} />);

    ref.current!.setValue('');
    expect(mockEditor.commands.clearContent).toHaveBeenCalled();
  });

  test('setValue handles whitespace-only string correctly', () => {
    const ref = React.createRef<RichTextEditorRef>();
    render(<RichTextEditor id="test-editor" ref={ref} />);

    ref.current!.setValue('   ');
    expect(mockEditor.commands.clearContent).toHaveBeenCalled();
  });

  test('setValue handles non-empty content correctly', () => {
    const ref = React.createRef<RichTextEditorRef>();
    render(<RichTextEditor id="test-editor" ref={ref} />);

    ref.current!.setValue('<p>new content</p>');
    expect(mockEditor.commands.setContent).toHaveBeenCalledWith('<p>new content</p>');
  });

  test('clearValue calls editor clearContent command and onChange', () => {
    const onChange = vi.fn();
    const ref = React.createRef<RichTextEditorRef>();
    render(<RichTextEditor id="test-editor" ref={ref} onChange={onChange} />);

    ref.current!.clearValue();
    expect(mockEditor.commands.clearContent).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith('');
  });

  test('renders with custom className', () => {
    render(<RichTextEditor id="test-editor" className="custom-class" />);

    const container = screen.getByTestId('editor-content');
    expect(container).toHaveClass('editor');
  });

  describe('Link popover', () => {
    test('opens popover when Link button is clicked', async () => {
      render(<RichTextEditor id="test-editor" />);
      const linkButton = screen.getByRole('button', { name: /link/i });
      await userEvent.click(linkButton);
      expect(screen.getByPlaceholderText('Paste a link...')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Display text')).toBeInTheDocument();
    });

    test('applies link with display text', async () => {
      render(<RichTextEditor id="test-editor" />);
      const linkButton = screen.getByRole('button', { name: /link/i });
      await userEvent.click(linkButton);
      const urlInput = screen.getByPlaceholderText('Paste a link...');
      const textInput = screen.getByPlaceholderText('Display text');
      await userEvent.type(urlInput, 'https://example.com');
      await userEvent.type(textInput, 'Example');
      // Use querySelector since the apply button doesn't have an accessible name
      const applyButton = document.querySelector('.editor-link-apply') as HTMLButtonElement;
      expect(applyButton).toBeInTheDocument();
      await userEvent.click(applyButton);
      // The editor should now contain the link HTML
      expect(mockEditor.getHTML()).toContain('<a href="https://example.com">Example</a>');
    });

    test('applies link with only URL as display text', async () => {
      render(<RichTextEditor id="test-editor" />);
      const linkButton = screen.getByRole('button', { name: /link/i });
      await userEvent.click(linkButton);
      const urlInput = screen.getByPlaceholderText('Paste a link...');
      await userEvent.type(urlInput, 'https://example.com');
      // Use querySelector since the apply button doesn't have an accessible name
      const applyButton = document.querySelector('.editor-link-apply') as HTMLButtonElement;
      expect(applyButton).toBeInTheDocument();
      await userEvent.click(applyButton);
      expect(mockEditor.getHTML()).toContain(
        '<a href="https://example.com">https://example.com</a>',
      );
    });

    test('cancel closes popover and does not insert link', async () => {
      render(<RichTextEditor id="test-editor" />);
      const linkButton = screen.getByRole('button', { name: /link/i });
      await userEvent.click(linkButton);
      const urlInput = screen.getByPlaceholderText('Paste a link...');
      await userEvent.type(urlInput, 'https://example.com');
      // Use querySelector since the cancel button doesn't have an accessible name
      const cancelButton = document.querySelector('.editor-link-delete') as HTMLButtonElement;
      expect(cancelButton).toBeInTheDocument();
      await userEvent.click(cancelButton);
      expect(screen.queryByPlaceholderText('Paste a link...')).not.toBeInTheDocument();
      // Reset the mock HTML after cancel
      mockEditor.getHTML.mockReturnValue('<p>test content</p>');
      expect(mockEditor.getHTML()).not.toContain('<a href="https://example.com"');
    });

    test('closes popover when escape key is pressed while popover is open', async () => {
      render(<RichTextEditor id="test-editor" />);

      // Open the popover first
      const linkButton = screen.getByRole('button', { name: /link/i });
      await userEvent.click(linkButton);
      expect(screen.getByPlaceholderText('Paste a link...')).toBeInTheDocument();

      // Press escape key to close popover
      await userEvent.keyboard('{Escape}');

      // Popover should be closed
      expect(screen.queryByPlaceholderText('Paste a link...')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Display text')).not.toBeInTheDocument();
    });

    test('pre-fills display text with selected text when link button is clicked with text selected', async () => {
      // Mock the editor state to have a non-empty selection
      mockEditor.state.selection.empty = false;
      mockEditor.state.selection.from = 0;
      mockEditor.state.selection.to = 5;
      (mockEditor.state.doc.textBetween as ReturnType<typeof vi.fn>).mockReturnValue(
        'selected text',
      );

      render(<RichTextEditor id="test-editor" />);

      // Click the link button
      const linkButton = screen.getByRole('button', { name: /link/i });
      await userEvent.click(linkButton);

      // The display text input should be pre-filled with the selected text
      const displayTextInput = screen.getByPlaceholderText('Display text');
      expect(displayTextInput).toHaveValue('selected text');
      expect(mockEditor.state.doc.textBetween).toHaveBeenCalledWith(0, 5, ' ');
    });

    test('pre-fills inputs with existing link when cursor is positioned within a link', async () => {
      // Mock the editor state to have empty selection but existing link attributes
      mockEditor.state.selection.empty = true;
      (mockEditor.getAttributes as ReturnType<typeof vi.fn>).mockReturnValue({
        href: 'https://existing.com',
        text: 'existing link text',
      });

      render(<RichTextEditor id="test-editor" />);

      // Click the link button
      const linkButton = screen.getByRole('button', { name: /link/i });
      await userEvent.click(linkButton);

      // Both inputs should be pre-filled with existing link data
      const urlInput = screen.getByPlaceholderText('Paste a link...');
      const displayTextInput = screen.getByPlaceholderText('Display text');

      expect(urlInput).toHaveValue('https://existing.com');
      expect(displayTextInput).toHaveValue('existing link text');
      expect(mockEditor.getAttributes).toHaveBeenCalledWith('link');
    });

    test('does not insert link when both linkText and linkUrl are empty in handleLinkApply', async () => {
      render(<RichTextEditor id="test-editor" />);
      const linkButton = screen.getByRole('button', { name: /link/i });
      await userEvent.click(linkButton);

      // Don't type anything in either input, leaving both linkText and linkUrl empty
      const applyButton = document.querySelector('.editor-link-apply') as HTMLButtonElement;
      expect(applyButton).toBeInTheDocument();

      // Clear the mock chain call count
      (mockEditor.chain as ReturnType<typeof vi.fn>).mockClear();

      await userEvent.click(applyButton);

      // Should not call insertContent when display is falsy
      expect(mockEditor.chain).not.toHaveBeenCalled();
      // Popover should still close
      expect(screen.queryByPlaceholderText('Paste a link...')).not.toBeInTheDocument();
    });

    test('does not insert link when malformed URL is sanitized to empty string', async () => {
      render(<RichTextEditor id="test-editor" />);
      const linkButton = screen.getByRole('button', { name: /link/i });
      await userEvent.click(linkButton);

      const urlInput = screen.getByPlaceholderText('Paste a link...');
      const textInput = screen.getByPlaceholderText('Display text');

      // Enter a malformed URL that will be sanitized to empty string
      await userEvent.type(urlInput, 'javascript:alert("xss")');
      await userEvent.type(textInput, 'Malicious Link');

      const applyButton = document.querySelector('.editor-link-apply') as HTMLButtonElement;
      expect(applyButton).toBeInTheDocument();

      // Clear the mock chain call count
      (mockEditor.chain as ReturnType<typeof vi.fn>).mockClear();

      await userEvent.click(applyButton);

      // Should not call insertContent when sanitized URL becomes empty string
      expect(mockEditor.chain).not.toHaveBeenCalled();
      // Popover should still close
      expect(screen.queryByPlaceholderText('Paste a link...')).not.toBeInTheDocument();
    });

    test('uses empty string fallback when existing link text attribute is falsy', async () => {
      // Mock the editor state to have empty selection but existing link with falsy text
      mockEditor.state.selection.empty = true;
      (mockEditor.getAttributes as ReturnType<typeof vi.fn>).mockReturnValue({
        href: 'https://existing.com',
        text: null, // Falsy text value to trigger the fallback
      });

      render(<RichTextEditor id="test-editor" />);

      // Click the link button
      const linkButton = screen.getByRole('button', { name: /link/i });
      await userEvent.click(linkButton);

      // The display text input should have empty value due to fallback
      const displayTextInput = screen.getByPlaceholderText('Display text');
      expect(displayTextInput).toHaveValue('');
      expect(mockEditor.getAttributes).toHaveBeenCalledWith('link');
    });

    test('closes link popover when clicking outside the popover area', async () => {
      // Capture the callback passed to useOutsideClick
      let outsideClickCallback: ((ev: MouseEvent) => void) | null = null;
      mockUseOutsideClick.mockImplementation(
        (_refs: unknown[], callback: (ev: MouseEvent) => void) => {
          outsideClickCallback = callback;
        },
      );

      // Mock getBoundingClientRect to return specific coordinates
      const mockGetBoundingClientRect = vi.fn().mockReturnValue({
        x: 100,
        y: 100,
        width: 200,
        height: 150,
      });

      render(<RichTextEditor id="test-editor" />);

      // Open the link popover
      const linkButton = screen.getByRole('button', { name: /link/i });
      await userEvent.click(linkButton);
      expect(screen.getByPlaceholderText('Paste a link...')).toBeInTheDocument();

      // Get the popover element and mock its getBoundingClientRect
      const popover = document.querySelector('.editor-link-popover') as HTMLDivElement;
      expect(popover).toBeInTheDocument();
      popover.getBoundingClientRect = mockGetBoundingClientRect;

      // Simulate a mousedown outside the popover bounds (outside x: 100-300, y: 100-250)
      const outsideClickEvent = new MouseEvent('mousedown', {
        clientX: 50, // Outside left boundary (< 100)
        clientY: 50, // Outside top boundary (< 100)
        bubbles: true,
      });

      // Trigger the outside click using the captured callback
      if (outsideClickCallback) {
        (outsideClickCallback as (ev: MouseEvent) => void)(outsideClickEvent);
      }

      // Wait for the popover to close
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Paste a link...')).not.toBeInTheDocument();
      });
    });

    test('keeps link popover open when clicking inside the popover area', async () => {
      // Capture the callback passed to useOutsideClick
      let outsideClickCallback: ((ev: MouseEvent) => void) | null = null;
      mockUseOutsideClick.mockImplementation(
        (_refs: unknown[], callback: (ev: MouseEvent) => void) => {
          outsideClickCallback = callback;
        },
      );

      // Mock getBoundingClientRect to return specific coordinates
      const mockGetBoundingClientRect = vi.fn().mockReturnValue({
        x: 100,
        y: 100,
        width: 200,
        height: 150,
      });

      render(<RichTextEditor id="test-editor" />);

      // Open the link popover
      const linkButton = screen.getByRole('button', { name: /link/i });
      await userEvent.click(linkButton);
      expect(screen.getByPlaceholderText('Paste a link...')).toBeInTheDocument();

      // Get the popover element and mock its getBoundingClientRect
      const popover = document.querySelector('.editor-link-popover') as HTMLDivElement;
      expect(popover).toBeInTheDocument();
      popover.getBoundingClientRect = mockGetBoundingClientRect;

      // Simulate a mousedown inside the popover bounds (within x: 100-300, y: 100-250)
      const insideClickEvent = new MouseEvent('mousedown', {
        clientX: 150, // Inside the boundaries
        clientY: 150, // Inside the boundaries
        bubbles: true,
      });

      // Trigger the inside click using the captured callback
      if (outsideClickCallback) {
        (outsideClickCallback as (ev: MouseEvent) => void)(insideClickEvent);
      }

      // Popover should remain open
      expect(screen.getByPlaceholderText('Paste a link...')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Display text')).toBeInTheDocument();
    });

    test('closes link popover when clicking beyond right boundary of popover', async () => {
      // Capture the callback passed to useOutsideClick
      let outsideClickCallback: ((ev: MouseEvent) => void) | null = null;
      mockUseOutsideClick.mockImplementation(
        (_refs: unknown[], callback: (ev: MouseEvent) => void) => {
          outsideClickCallback = callback;
        },
      );

      // Mock getBoundingClientRect to return specific coordinates
      const mockGetBoundingClientRect = vi.fn().mockReturnValue({
        x: 100,
        y: 100,
        width: 200,
        height: 150,
      });

      render(<RichTextEditor id="test-editor" />);

      // Open the link popover
      const linkButton = screen.getByRole('button', { name: /link/i });
      await userEvent.click(linkButton);
      expect(screen.getByPlaceholderText('Paste a link...')).toBeInTheDocument();

      // Get the popover element and mock its getBoundingClientRect
      const popover = document.querySelector('.editor-link-popover') as HTMLDivElement;
      expect(popover).toBeInTheDocument();
      popover.getBoundingClientRect = mockGetBoundingClientRect;

      // Simulate a mousedown outside the right boundary (containerRight = x + width = 100 + 200 = 300)
      const outsideRightClickEvent = new MouseEvent('mousedown', {
        clientX: 301, // Outside right boundary (> 300)
        clientY: 150, // Inside vertical boundaries
        bubbles: true,
      });

      // Trigger the outside click using the captured callback
      if (outsideClickCallback) {
        (outsideClickCallback as (ev: MouseEvent) => void)(outsideRightClickEvent);
      }

      // Wait for the popover to close
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Paste a link...')).not.toBeInTheDocument();
      });
    });
  });

  test('getHtml returns empty string when editor getHTML returns falsy value', () => {
    const ref = React.createRef<RichTextEditorRef>();

    // Mock getHTML to return null/undefined to test the fallback
    mockEditor.getHTML.mockReturnValue(null);

    render(<RichTextEditor id="test-editor" ref={ref} />);

    expect(ref.current!.getHtml()).toBe('');
    expect(mockEditor.getHTML).toHaveBeenCalled();
  });

  test('getValue returns empty string when editor getText returns falsy value', () => {
    const ref = React.createRef<RichTextEditorRef>();

    // Mock getText to return null/undefined to test the fallback
    mockEditor.getText.mockReturnValue(null);

    render(<RichTextEditor id="test-editor" ref={ref} />);

    expect(ref.current!.getValue()).toBe('');
    expect(mockEditor.getText).toHaveBeenCalled();
  });
});
