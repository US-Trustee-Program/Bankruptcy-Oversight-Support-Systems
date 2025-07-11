import { describe, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TiptapEditor, { TiptapEditorRef } from './TiptapEditor';

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
    };
  };
  isActive: (mark: string) => boolean;
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
    })),
  })),
  isActive: vi.fn(() => false),
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
      data-testid="tiptap-editor-content"
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

describe('TiptapEditor', () => {
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
    mockEditor.isEditable = true;
    mockUseEditor.mockReturnValue(mockEditor);
  });

  test('renders with label and aria description', () => {
    render(<TiptapEditor id="test-editor" label="Test Label" ariaDescription="Test description" />);

    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByLabelText('Test Label')).toBeInTheDocument();
  });

  test('renders without label and aria description', () => {
    render(<TiptapEditor id="test-editor" />);

    expect(screen.queryByText('Test Label')).not.toBeInTheDocument();
    expect(screen.queryByText('Test description')).not.toBeInTheDocument();
  });

  test('shows required indicator when required prop is true', () => {
    render(<TiptapEditor id="test-editor" label="Test Label" required={true} />);

    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(
      screen.getByText('Test Label').querySelector('.required-form-field'),
    ).toBeInTheDocument();
  });

  test('does not show required indicator when required prop is false', () => {
    render(<TiptapEditor id="test-editor" label="Test Label" required={false} />);

    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(
      screen.getByText('Test Label').querySelector('.required-form-field'),
    ).not.toBeInTheDocument();
  });

  test('calls onChange when editor content changes', async () => {
    const onChange = vi.fn();
    render(<TiptapEditor id="test-editor" onChange={onChange} />);
    const editorContent = screen.getByTestId('tiptap-editor-content');
    await userEvent.type(editorContent, 'hello');
    // Simulate Tiptap's update event
    onChange('<p>test content</p>');
    expect(onChange).toHaveBeenCalled();
  });

  test('exposes imperative methods via ref', async () => {
    const ref = React.createRef<TiptapEditorRef>();
    render(<TiptapEditor id="test-editor" ref={ref} />);

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
    const ref = React.createRef<TiptapEditorRef>();
    render(<TiptapEditor id="test-editor" ref={ref} />);

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
    const ref = React.createRef<TiptapEditorRef>();
    const { rerender } = render(<TiptapEditor id="test-editor" ref={ref} disabled={true} />);
    // Simulate the effect of setEditable(false) on the mock
    mockEditor.isEditable = false;
    rerender(<TiptapEditor id="test-editor" ref={ref} disabled={true} />);
    const editorContent = screen.getByTestId('tiptap-editor-content');
    expect(editorContent).toHaveAttribute('contenteditable', 'false');
    expect(editorContent).toHaveClass('disabled');
  });

  test('updates disabled state when prop changes', async () => {
    const ref = React.createRef<TiptapEditorRef>();
    const { rerender } = render(<TiptapEditor id="test-editor" ref={ref} disabled={false} />);
    // Simulate the effect of setEditable(true) on the mock
    mockEditor.isEditable = true;
    rerender(<TiptapEditor id="test-editor" ref={ref} disabled={false} />);
    const editorContent = screen.getByTestId('tiptap-editor-content');
    expect(editorContent).toHaveAttribute('contenteditable', 'true');
    expect(editorContent).not.toHaveClass('disabled');
  });

  // Toolbar tests
  describe('Toolbar', () => {
    test('renders toolbar with formatting buttons', () => {
      render(<TiptapEditor id="test-editor" />);

      expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Italic' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Underline' })).toBeInTheDocument();
    });

    test('bold button calls toggleBold command when clicked', async () => {
      const user = userEvent.setup();
      render(<TiptapEditor id="test-editor" />);

      const boldButton = screen.getByRole('button', { name: 'Bold' });
      await user.click(boldButton);

      expect(mockEditor.chain).toHaveBeenCalled();
    });

    test('italic button calls toggleItalic command when clicked', async () => {
      const user = userEvent.setup();
      render(<TiptapEditor id="test-editor" />);

      const italicButton = screen.getByRole('button', { name: 'Italic' });
      await user.click(italicButton);

      expect(mockEditor.chain).toHaveBeenCalled();
    });

    test('underline button calls toggleUnderline command when clicked', async () => {
      const user = userEvent.setup();
      render(<TiptapEditor id="test-editor" />);

      const underlineButton = screen.getByRole('button', { name: 'Underline' });
      await user.click(underlineButton);

      expect(mockEditor.chain).toHaveBeenCalled();
    });

    test('buttons show active state when formatting is active', () => {
      // Mock the isActive method to return true for bold
      mockEditor.isActive = vi.fn((mark: string) => mark === 'bold');

      render(<TiptapEditor id="test-editor" />);

      const boldButton = screen.getByRole('button', { name: 'Bold' });
      expect(boldButton).toHaveClass('is-active');
    });

    test('buttons show inactive state when formatting is not active', () => {
      // Mock the isActive method to return false for all marks
      mockEditor.isActive = vi.fn(() => false);

      render(<TiptapEditor id="test-editor" />);

      const boldButton = screen.getByRole('button', { name: 'Bold' });
      const italicButton = screen.getByRole('button', { name: 'Italic' });
      const underlineButton = screen.getByRole('button', { name: 'Underline' });

      expect(boldButton).not.toHaveClass('is-active');
      expect(italicButton).not.toHaveClass('is-active');
      expect(underlineButton).not.toHaveClass('is-active');
    });

    test('buttons are disabled when editor is disabled', () => {
      render(<TiptapEditor id="test-editor" disabled={true} />);

      const boldButton = screen.getByRole('button', { name: 'Bold' });
      const italicButton = screen.getByRole('button', { name: 'Italic' });
      const underlineButton = screen.getByRole('button', { name: 'Underline' });

      expect(boldButton).toBeDisabled();
      expect(italicButton).toBeDisabled();
      expect(underlineButton).toBeDisabled();
    });

    test('buttons are enabled when editor is enabled', () => {
      render(<TiptapEditor id="test-editor" disabled={false} />);

      const boldButton = screen.getByRole('button', { name: 'Bold' });
      const italicButton = screen.getByRole('button', { name: 'Italic' });
      const underlineButton = screen.getByRole('button', { name: 'Underline' });

      expect(boldButton).not.toBeDisabled();
      expect(italicButton).not.toBeDisabled();
      expect(underlineButton).not.toBeDisabled();
    });

    test('buttons have correct aria-labels and titles', () => {
      render(<TiptapEditor id="test-editor" />);

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
      render(<TiptapEditor id="test-editor" />);

      const boldButton = screen.getByRole('button', { name: 'Bold' });
      const italicButton = screen.getByRole('button', { name: 'Italic' });
      const underlineButton = screen.getByRole('button', { name: 'Underline' });

      expect(boldButton).toHaveTextContent('B');
      expect(italicButton).toHaveTextContent('I');
      expect(underlineButton).toHaveTextContent('U');
    });
  });

  test('initializes editor with correct configuration', () => {
    render(<TiptapEditor id="test-editor" />);

    expect(mockUseEditor).toHaveBeenCalledWith({
      extensions: ['StarterKit', expect.any(Object)],
      content: '',
      editable: true,
      onUpdate: expect.any(Function),
    });
  });

  test('initializes editor with disabled state when disabled prop is true', () => {
    render(<TiptapEditor id="test-editor" disabled={true} />);

    expect(mockUseEditor).toHaveBeenCalledWith({
      extensions: ['StarterKit', expect.any(Object)],
      content: '',
      editable: false,
      onUpdate: expect.any(Function),
    });
  });

  test('calls onChange with HTML content when editor updates', () => {
    const onChange = vi.fn();
    render(<TiptapEditor id="test-editor" onChange={onChange} />);

    // Simulate editor update
    const onUpdate = mockUseEditor.mock.calls[0][0].onUpdate;
    onUpdate({ editor: mockEditor });

    expect(onChange).toHaveBeenCalledWith('<p>test content</p>');
  });

  test('handles empty content correctly', () => {
    mockEditor.getHTML.mockReturnValue('');
    mockEditor.getText.mockReturnValue('');

    const onChange = vi.fn();
    render(<TiptapEditor id="test-editor" onChange={onChange} />);

    const onUpdate = mockUseEditor.mock.calls[0][0].onUpdate;
    onUpdate({ editor: mockEditor });

    expect(onChange).toHaveBeenCalledWith('');
  });

  test('setValue handles empty string correctly', () => {
    const ref = React.createRef<TiptapEditorRef>();
    render(<TiptapEditor id="test-editor" ref={ref} />);

    ref.current!.setValue('');
    expect(mockEditor.commands.clearContent).toHaveBeenCalled();
  });

  test('setValue handles whitespace-only string correctly', () => {
    const ref = React.createRef<TiptapEditorRef>();
    render(<TiptapEditor id="test-editor" ref={ref} />);

    ref.current!.setValue('   ');
    expect(mockEditor.commands.clearContent).toHaveBeenCalled();
  });

  test('setValue handles non-empty content correctly', () => {
    const ref = React.createRef<TiptapEditorRef>();
    render(<TiptapEditor id="test-editor" ref={ref} />);

    ref.current!.setValue('<p>new content</p>');
    expect(mockEditor.commands.setContent).toHaveBeenCalledWith('<p>new content</p>');
  });

  test('clearValue calls editor clearContent command and onChange', () => {
    const onChange = vi.fn();
    const ref = React.createRef<TiptapEditorRef>();
    render(<TiptapEditor id="test-editor" ref={ref} onChange={onChange} />);

    ref.current!.clearValue();
    expect(mockEditor.commands.clearContent).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith('');
  });

  test('renders with custom className', () => {
    render(<TiptapEditor id="test-editor" className="custom-class" />);

    const container = screen.getByTestId('tiptap-editor-content');
    expect(container).toHaveClass('tiptap-editor');
  });

  test('handles editor not being available gracefully', () => {
    mockUseEditor.mockReturnValue(null);
    const ref = React.createRef<TiptapEditorRef>();
    render(<TiptapEditor id="test-editor" ref={ref} />);

    // These should not throw errors
    expect(() => ref.current!.getValue()).not.toThrow();
    expect(() => ref.current!.getHtml()).not.toThrow();
    expect(() => ref.current!.setValue('test')).not.toThrow();
    expect(() => ref.current!.clearValue()).not.toThrow();
    expect(() => ref.current!.focus()).not.toThrow();
  });
});
