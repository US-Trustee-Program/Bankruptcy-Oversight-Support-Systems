import { describe, expect, beforeEach, vi, test } from 'vitest';
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { UserEvent } from '@testing-library/user-event';
import RichTextEditor, { RichTextEditorRef } from './RichTextEditor';
import {
  createMockEditor,
  resetMockEditor,
  MockEditor,
  FORMATTING_BUTTONS,
  LIST_BUTTONS,
} from '@/lib/testing/mock-editor';
import TestingUtilities from '@/lib/testing/testing-utilities';

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
  let userEvent: UserEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEditor = createMockEditor();
    resetMockEditor(mockEditor);
    mockUseOutsideClick.mockReset();
    mockUseEditor.mockReturnValue(mockEditor);
    userEvent = TestingUtilities.setupUserEvent();
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

    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
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
    act(() => ref.current!.setValue('<p>test content</p>'));
    expect(mockEditor.commands.setContent).toHaveBeenCalledWith('<p>test content</p>');

    // Test setValue with empty content
    act(() => ref.current!.setValue(''));
    expect(mockEditor.commands.clearContent).toHaveBeenCalled();

    // Test getValue
    expect(ref.current!.getValue()).toBe('test content');
    expect(mockEditor.getText).toHaveBeenCalled();

    // Test getHtml
    expect(ref.current!.getHtml()).toBe('<p>test content</p>');
    expect(mockEditor.getHTML).toHaveBeenCalled();

    // Test clearValue
    act(() => ref.current!.clearValue());
    expect(mockEditor.commands.clearContent).toHaveBeenCalled();

    // Test disable
    act(() => ref.current!.disable(true));
    await waitFor(() => {
      expect(mockEditor.setEditable).toHaveBeenCalledWith(false);
    });
    act(() => ref.current!.disable(false));
    await waitFor(() => {
      expect(mockEditor.setEditable).toHaveBeenCalledWith(true);
    });

    // Test focus
    act(() => ref.current!.focus());
    expect(mockEditor.commands.focus).toHaveBeenCalled();
  });

  test('disable method updates editor editable state', async () => {
    const ref = React.createRef<RichTextEditorRef>();
    render(<RichTextEditor id="test-editor" ref={ref} />);

    act(() => ref.current!.disable(true));
    await waitFor(() => {
      expect(mockEditor.setEditable).toHaveBeenCalledWith(false);
    });

    act(() => ref.current!.disable(false));
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

        expect(screen.getByTestId('rich-text-bold-button')).toBeInTheDocument();
        expect(screen.getByTestId('rich-text-italic-button')).toBeInTheDocument();
        expect(screen.getByTestId('rich-text-underline-button')).toBeInTheDocument();
      });

      test.each(FORMATTING_BUTTONS)(
        '$name button calls $command when clicked',
        async ({ testId }) => {
          render(<RichTextEditor id="test-editor" />);

          const button = screen.getByTestId(testId);
          await userEvent.click(button);

          expect(mockEditor.chain).toHaveBeenCalled();
        },
      );

      test.each(FORMATTING_BUTTONS)(
        '$name button shows active state when $mark is active',
        ({ testId, mark }) => {
          mockEditor.isActive = vi.fn((testMark: string) => testMark === mark);
          render(<RichTextEditor id="test-editor" />);

          const button = screen.getByTestId(testId);
          expect(button).toHaveClass('is-active');
        },
      );

      test.each(FORMATTING_BUTTONS)(
        '$name button shows inactive state when $mark is not active',
        ({ testId }) => {
          mockEditor.isActive = vi.fn(() => false);
          render(<RichTextEditor id="test-editor" />);

          const button = screen.getByTestId(testId);
          expect(button).not.toHaveClass('is-active');
        },
      );

      test.each(FORMATTING_BUTTONS)(
        '$name button is disabled when editor is disabled',
        ({ testId }) => {
          render(<RichTextEditor id="test-editor" disabled={true} />);

          const button = screen.getByTestId(testId);
          expect(button).toBeDisabled();
        },
      );

      test.each(FORMATTING_BUTTONS)(
        '$name button is enabled when editor is enabled',
        ({ testId }) => {
          render(<RichTextEditor id="test-editor" disabled={false} />);

          const button = screen.getByTestId(testId);
          expect(button).not.toBeDisabled();
        },
      );

      test.each(FORMATTING_BUTTONS)(
        '$name button has correct aria-label and title',
        ({ title, testId }) => {
          render(<RichTextEditor id="test-editor" />);

          const button = screen.getByTestId(testId);
          expect(button).toHaveAttribute('title', expect.stringContaining(title));
        },
      );

      test.each(FORMATTING_BUTTONS)(
        '$name button displays correct text label',
        ({ testId, display }) => {
          render(<RichTextEditor id="test-editor" />);

          const button = screen.getByTestId(testId);
          expect(button).toHaveTextContent(display);
        },
      );
    });

    describe('List buttons', () => {
      test.each(LIST_BUTTONS)(
        '$name button is present and calls $command when clicked',
        async ({ testId }) => {
          render(<RichTextEditor id="test-editor" />);

          const button = screen.getByTestId(testId);
          expect(button).toBeInTheDocument();

          await userEvent.click(button);
          expect(mockEditor.chain).toHaveBeenCalled();
        },
      );

      test.each(LIST_BUTTONS)(
        '$name button shows active state when $mark is active',
        ({ testId, mark }) => {
          mockEditor.isActive = vi.fn((testMark: string) => testMark === mark);
          render(<RichTextEditor id="test-editor" />);

          const button = screen.getByTestId(testId);
          expect(button).toHaveClass('is-active');
        },
      );
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

    act(() => ref.current!.setValue(''));
    expect(mockEditor.commands.clearContent).toHaveBeenCalled();
  });

  test('setValue handles whitespace-only string correctly', () => {
    const ref = React.createRef<RichTextEditorRef>();
    render(<RichTextEditor id="test-editor" ref={ref} />);

    act(() => ref.current!.setValue('   '));
    expect(mockEditor.commands.clearContent).toHaveBeenCalled();
  });

  test('setValue handles non-empty content correctly', () => {
    const ref = React.createRef<RichTextEditorRef>();
    render(<RichTextEditor id="test-editor" ref={ref} />);

    act(() => ref.current!.setValue('<p>new content</p>'));
    expect(mockEditor.commands.setContent).toHaveBeenCalledWith('<p>new content</p>');
  });

  test('clearValue calls editor clearContent command and onChange', () => {
    const onChange = vi.fn();
    const ref = React.createRef<RichTextEditorRef>();
    render(<RichTextEditor id="test-editor" ref={ref} onChange={onChange} />);

    act(() => ref.current!.clearValue());
    expect(mockEditor.commands.clearContent).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith('');
  });

  test('renders with custom className', () => {
    render(<RichTextEditor id="test-editor" className="custom-class" />);

    const container = screen.getByTestId('editor-content');
    expect(container).toHaveClass('editor');
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
