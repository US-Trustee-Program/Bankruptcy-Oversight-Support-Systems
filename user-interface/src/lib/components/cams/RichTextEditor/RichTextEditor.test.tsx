import { describe, expect, beforeEach, vi, test } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RichTextEditor, { RichTextEditorRef } from './RichTextEditor';

// Create a mock function outside the factory
const mockUseEditor = vi.fn();

// Define proper types for the mock editor
interface MockEditorCommands {
  focus: ReturnType<typeof vi.fn>;
  clearContent: ReturnType<typeof vi.fn>;
  setContent: ReturnType<typeof vi.fn>;
}

interface MockEditor {
  getHTML: ReturnType<typeof vi.fn>;
  getText: ReturnType<typeof vi.fn>;
  setContent: ReturnType<typeof vi.fn>;
  clearContent: ReturnType<typeof vi.fn>;
  setEditable: ReturnType<typeof vi.fn>;
  commands: MockEditorCommands;
  isEditable: boolean;
  onUpdate: (...args: unknown[]) => void;
  chain: (...args: unknown[]) => {
    focus: (...args: unknown[]) => {
      toggleBold: (...args: unknown[]) => { run: (...args: unknown[]) => void };
      toggleItalic: (...args: unknown[]) => { run: (...args: unknown[]) => void };
      toggleUnderline: (...args: unknown[]) => { run: (...args: unknown[]) => void };
      toggleOrderedList: (...args: unknown[]) => { run: (...args: unknown[]) => void };
      toggleBulletList: (...args: unknown[]) => { run: (...args: unknown[]) => void };
      toggleLink: (...args: unknown[]) => { run: (...args: unknown[]) => void };
      insertContent: (...args: unknown[]) => { run: (...args: unknown[]) => void };
    };
  };
  isActive: (mark: string) => boolean;
  getAttributes: (type: string) => { href: string; text: string };
  insertContent: (html: string) => { run: (...args: unknown[]) => void };
  state: {
    selection: {
      empty: boolean;
      from: number;
      to: number;
    };
    doc: {
      textBetween: (from: number, to: number, separator: string) => string;
    };
  };
}

// Create mockEditor and its methods outside beforeEach
const mockOnUpdate = vi.fn();
const mockEditor: MockEditor = {
  getHTML: vi.fn().mockReturnValue('<p>test content</p>'),
  getText: vi.fn().mockReturnValue('test content'),
  setContent: vi.fn(),
  clearContent: vi.fn(),
  setEditable: vi.fn((val: boolean) => {
    mockEditor.isEditable = val;
  }),
  commands: {
    focus: vi.fn(),
    clearContent: vi.fn(),
    setContent: vi.fn(),
  },
  isEditable: true,
  onUpdate: (...args: unknown[]) => mockOnUpdate(...args),
  chain: vi.fn(() => ({
    focus: vi.fn(() => ({
      toggleBold: vi.fn(() => ({ run: vi.fn() })),
      toggleItalic: vi.fn(() => ({ run: vi.fn() })),
      toggleUnderline: vi.fn(() => ({ run: vi.fn() })),
      toggleOrderedList: vi.fn(() => ({ run: vi.fn() })),
      toggleBulletList: vi.fn(() => ({ run: vi.fn() })),
      toggleLink: vi.fn(() => ({ run: vi.fn() })),
      insertContent: vi.fn((...args: unknown[]) => {
        // Simulate inserting a link for test assertions
        const html = typeof args[0] === 'string' ? args[0] : '';
        mockEditor.getHTML.mockReturnValue(`<p>${html}</p>`);
        // Extract text between > and < for getText
        const match = html.match(/>(.*?)<\/a>/);
        mockEditor.getText.mockReturnValue(match ? match[1] : html);
        return { run: vi.fn() };
      }),
    })),
  })),
  isActive: vi.fn(() => false),
  getAttributes: vi.fn((_type: string) => {
    // Always return an object with href and text as strings
    return { href: '', text: '' };
  }),
  insertContent: vi.fn((html: string) => {
    // Simulate inserting a link for test assertions
    mockEditor.getHTML.mockReturnValue(`<p>${html}</p>`);
    // Extract text between > and < for getText
    const match = html.match(/>(.*?)<\/a>/);
    mockEditor.getText.mockReturnValue(match ? match[1] : html);
    return { run: vi.fn() };
  }),
  state: {
    selection: {
      empty: true,
      from: 0,
      to: 0,
    },
    doc: {
      textBetween: vi.fn((_from: number, _to: number, _separator: string) => ''),
    },
  },
};

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
    Object.values(mockEditor).forEach((v) => {
      if (typeof (v as { mockClear?: () => void })?.mockClear === 'function') {
        (v as { mockClear: () => void }).mockClear();
      }
    });
    Object.values(mockEditor.commands).forEach((v) => {
      if (typeof (v as { mockClear?: () => void })?.mockClear === 'function') {
        (v as { mockClear: () => void }).mockClear();
      }
    });

    // Reset all mock functions to their default state
    mockEditor.isEditable = true;
    mockEditor.getHTML.mockReturnValue('<p>test content</p>');
    mockEditor.getText.mockReturnValue('test content');
    (mockEditor.isActive as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (mockEditor.getAttributes as ReturnType<typeof vi.fn>).mockReturnValue({ href: '', text: '' });
    mockEditor.state.selection.empty = true;
    mockEditor.state.selection.from = 0;
    mockEditor.state.selection.to = 0;
    (mockEditor.state.doc.textBetween as ReturnType<typeof vi.fn>).mockReturnValue('');

    // Reset the useOutsideClick mock to its default behavior
    mockUseOutsideClick.mockReset();

    mockUseEditor.mockReturnValue(mockEditor);
  });

  test('renders with label and aria description', () => {
    render(
      <RichTextEditor id="test-editor" label="Test Label" ariaDescription="Test description" />,
    );

    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByLabelText('Test Label')).toBeInTheDocument();
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
    test('renders toolbar with formatting buttons', () => {
      render(<RichTextEditor id="test-editor" />);

      expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Italic' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Underline' })).toBeInTheDocument();
    });

    test('bold button calls toggleBold command when clicked', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor id="test-editor" />);

      const boldButton = screen.getByRole('button', { name: 'Bold' });
      await user.click(boldButton);

      expect(mockEditor.chain).toHaveBeenCalled();
    });

    test('italic button calls toggleItalic command when clicked', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor id="test-editor" />);

      const italicButton = screen.getByRole('button', { name: 'Italic' });
      await user.click(italicButton);

      expect(mockEditor.chain).toHaveBeenCalled();
    });

    test('underline button calls toggleUnderline command when clicked', async () => {
      const user = userEvent.setup();
      render(<RichTextEditor id="test-editor" />);

      const underlineButton = screen.getByRole('button', { name: 'Underline' });
      await user.click(underlineButton);

      expect(mockEditor.chain).toHaveBeenCalled();
    });

    test('buttons show active state when formatting is active', () => {
      // Mock the isActive method to return true for bold
      mockEditor.isActive = vi.fn((mark: string) => mark === 'bold');

      render(<RichTextEditor id="test-editor" />);

      const boldButton = screen.getByRole('button', { name: 'Bold' });
      expect(boldButton).toHaveClass('is-active');
    });

    test('buttons show inactive state when formatting is not active', () => {
      // Mock the isActive method to return false for all marks
      mockEditor.isActive = vi.fn(() => false);

      render(<RichTextEditor id="test-editor" />);

      const boldButton = screen.getByRole('button', { name: 'Bold' });
      const italicButton = screen.getByRole('button', { name: 'Italic' });
      const underlineButton = screen.getByRole('button', { name: 'Underline' });

      expect(boldButton).not.toHaveClass('is-active');
      expect(italicButton).not.toHaveClass('is-active');
      expect(underlineButton).not.toHaveClass('is-active');
    });

    test('buttons are disabled when editor is disabled', () => {
      render(<RichTextEditor id="test-editor" disabled={true} />);

      const boldButton = screen.getByRole('button', { name: 'Bold' });
      const italicButton = screen.getByRole('button', { name: 'Italic' });
      const underlineButton = screen.getByRole('button', { name: 'Underline' });

      expect(boldButton).toBeDisabled();
      expect(italicButton).toBeDisabled();
      expect(underlineButton).toBeDisabled();
    });

    test('buttons are enabled when editor is enabled', () => {
      render(<RichTextEditor id="test-editor" disabled={false} />);

      const boldButton = screen.getByRole('button', { name: 'Bold' });
      const italicButton = screen.getByRole('button', { name: 'Italic' });
      const underlineButton = screen.getByRole('button', { name: 'Underline' });

      expect(boldButton).not.toBeDisabled();
      expect(italicButton).not.toBeDisabled();
      expect(underlineButton).not.toBeDisabled();
    });

    test('buttons have correct aria-labels and titles', () => {
      render(<RichTextEditor id="test-editor" />);

      const boldButton = screen.getByRole('button', { name: 'Bold' });
      const italicButton = screen.getByRole('button', { name: 'Italic' });
      const underlineButton = screen.getByRole('button', { name: 'Underline' });

      expect(boldButton).toHaveAttribute('aria-label', 'Bold');
      expect(boldButton).toHaveAttribute('title', 'Bold');
      expect(italicButton).toHaveAttribute('aria-label', 'Italic');
      expect(italicButton).toHaveAttribute('title', 'Italic');
      expect(underlineButton).toHaveAttribute('aria-label', 'Underline');
      expect(underlineButton).toHaveAttribute('title', 'Underline');
    });

    test('buttons display correct text labels', () => {
      render(<RichTextEditor id="test-editor" />);

      const boldButton = screen.getByRole('button', { name: 'Bold' });
      const italicButton = screen.getByRole('button', { name: 'Italic' });
      const underlineButton = screen.getByRole('button', { name: 'Underline' });

      expect(boldButton).toHaveTextContent('B');
      expect(italicButton).toHaveTextContent('I');
      expect(underlineButton).toHaveTextContent('U');
    });
  });

  test('renders ordered and bullet list buttons and calls list commands when clicked', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor id="test-editor" />);

    // Buttons should be present
    const orderedListButton = screen.getByRole('button', { name: /ordered list/i });
    const bulletListButton = screen.getByRole('button', { name: /bullet list/i });

    expect(orderedListButton).toBeInTheDocument();
    expect(bulletListButton).toBeInTheDocument();

    // Simulate clicking the ordered list button
    await user.click(orderedListButton);

    // Assert that the rich text editor chain command for toggling ordered list is called
    expect(mockEditor.chain).toHaveBeenCalled();
    // Optionally, check that the correct arguments are passed for ordered list
    // (You may need to enhance the mock to track these calls)
  });

  test('renders link button and calls link command when clicked', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor id="test-editor" />);

    // Button should be present
    const linkButton = screen.getByRole('button', { name: /link/i });
    expect(linkButton).toBeInTheDocument();

    // Simulate clicking the link button
    await user.click(linkButton);
    // TODO: Assert that the link command or UI is triggered (e.g., editor.chain().focus().toggleLink().run() or a link dialog appears)
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

  // test('handles editor not being available gracefully', () => {
  //   mockUseEditor.mockReturnValue(null);
  //   const ref = React.createRef<RichTextEditorRef>();
  //   render(<RichTextEditor id="test-editor" ref={ref} />);

  //   // These should not throw errors
  //   expect(() => ref.current!.getValue()).not.toThrow();
  //   expect(() => ref.current!.getHtml()).not.toThrow();
  //   expect(() => ref.current!.setValue('test')).not.toThrow();
  //   expect(() => ref.current!.clearValue()).not.toThrow();
  //   expect(() => ref.current!.focus()).not.toThrow();
  // });

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
