import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import NoteFormModal, { NoteFormModalRef } from './NoteFormModal';
import { NoteInput } from './types';
import React from 'react';
import LocalFormCache from '@/lib/utils/local-form-cache';
import userEvent from '@testing-library/user-event';
import { RichTextEditorRef } from '@/lib/components/cams/RichTextEditor/RichTextEditor';

/**
 * NOTE: We mock RichTextEditor to avoid jsdom/ProseMirror compatibility issues.
 * The mock provides the same interface as the real RichTextEditor but uses a simple
 * contentEditable div instead of ProseMirror.
 */
vi.mock('@/lib/components/cams/RichTextEditor/RichTextEditor', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const MockRichTextEditor = React.forwardRef(
    (
      props: {
        id: string;
        label?: string;
        onChange?: (value: string) => void;
        disabled?: boolean;
        required?: boolean;
        className?: string;
      },
      ref: React.Ref<RichTextEditorRef>,
    ) => {
      const [content, setContent] = React.useState('<p><br class="ProseMirror-trailingBreak"></p>');
      const contentRef = React.useRef(content);
      const [disabled, setDisabled] = React.useState(props.disabled || false);

      const isEmptyContent = (c: string) =>
        !c ||
        c === '<p><br class="ProseMirror-trailingBreak"></p>' ||
        c === '<p></p>' ||
        c.trim() === '';

      React.useImperativeHandle(ref, () => ({
        clearValue: () => {
          const empty = '<p><br class="ProseMirror-trailingBreak"></p>';
          contentRef.current = empty;
          setContent(empty);
          props.onChange?.('');
        },
        getValue: () => contentRef.current,
        getHtml: () => (isEmptyContent(contentRef.current) ? '' : contentRef.current),
        setValue: (value: string) => {
          if (!value || value.trim() === '') {
            const empty = '<p><br class="ProseMirror-trailingBreak"></p>';
            contentRef.current = empty;
            setContent(empty);
            props.onChange?.(empty);
          } else if (value.startsWith('<')) {
            contentRef.current = value;
            setContent(value);
            props.onChange?.(value);
          } else {
            const wrapped = `<p>${value}</p>`;
            contentRef.current = wrapped;
            setContent(wrapped);
            props.onChange?.(wrapped);
          }
        },
        disable: (value: boolean) => setDisabled(value),
        focus: () => {},
      }));

      React.useEffect(() => {
        setDisabled(props.disabled || false);
      }, [props.disabled]);

      React.useEffect(() => {
        contentRef.current = content;
      }, [content]);

      return React.createElement(
        'div',
        { className: 'usa-form-group editor-container', id: `${props.id}-container` },
        props.label &&
          React.createElement(
            'label',
            { id: `editor-label-${props.id}`, className: 'usa-label' },
            props.label,
            props.required && React.createElement('span', { className: 'required-form-field' }),
          ),
        React.createElement(
          'div',
          { className: 'editor-wrapper' },
          React.createElement('div', { className: 'editor-toolbar' }),
          React.createElement('div', {
            className: 'editor-content editor',
            'data-testid': 'editor-content',
            contentEditable: !disabled,
            dangerouslySetInnerHTML: { __html: content },
          }),
        ),
      );
    },
  );
  MockRichTextEditor.displayName = 'MockRichTextEditor';
  return { default: MockRichTextEditor, RichTextEditorRef: undefined };
});

const SUBMIT_BUTTON_ID = 'button-test-note-modal-submit-button';

describe('NoteFormModal', () => {
  let modalRef: React.RefObject<NoteFormModalRef>;
  let mockOnSave: (noteData: NoteInput) => Promise<void>;
  let mockOnModalClosed: () => void;

  beforeEach(() => {
    vi.restoreAllMocks();
    modalRef = React.createRef<NoteFormModalRef>() as React.RefObject<NoteFormModalRef>;
    mockOnSave = vi.fn().mockResolvedValue(undefined);
    mockOnModalClosed = vi.fn();

    vi.spyOn(LocalFormCache, 'saveForm').mockReturnValue(undefined);
    vi.spyOn(LocalFormCache, 'clearForm').mockReturnValue(undefined);
  });

  test('should render modal with create mode heading', async () => {
    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        ref={modalRef}
      />,
    );

    modalRef.current?.show({
      mode: 'create',
      entityId: 'entity-123',
      title: '',
      content: '',
      cacheKey: 'notes-entity-123',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: '',
      initialContent: '',
    });

    await waitFor(() => {
      expect(screen.getByText('Create Note')).toBeInTheDocument();
    });
  });

  test('should render modal with edit mode heading', async () => {
    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        ref={modalRef}
      />,
    );

    modalRef.current?.show({
      id: 'note-456',
      mode: 'edit',
      entityId: 'entity-123',
      title: 'Existing Note',
      content: 'Existing content',
      cacheKey: 'notes-entity-123-note-456',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: 'Existing Note',
      initialContent: 'Existing content',
    });

    await waitFor(() => {
      expect(screen.getByText('Edit Note')).toBeInTheDocument();
    });
  });

  test('should render form fields', async () => {
    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        ref={modalRef}
      />,
    );

    modalRef.current?.show({
      mode: 'create',
      entityId: 'entity-123',
      title: '',
      content: '',
      cacheKey: 'notes-entity-123',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: '',
      initialContent: '',
    });

    await waitFor(() => {
      expect(screen.getByTestId('note-title-input')).toBeInTheDocument();
    });

    expect(screen.getByText('Note Title')).toBeInTheDocument();
    expect(screen.getByText('Note Text')).toBeInTheDocument();
  });

  test('should use provided cache key for draft storage', async () => {
    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        ref={modalRef}
      />,
    );

    const cacheKey = 'notes-entity-123';
    modalRef.current?.show({
      mode: 'create',
      entityId: 'entity-123',
      title: 'Test',
      content: '<p>Test</p>',
      cacheKey,
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: '',
      initialContent: '',
    });

    await waitFor(() => {
      expect(LocalFormCache.saveForm).toHaveBeenCalled();
      const calls = (LocalFormCache.saveForm as ReturnType<typeof vi.fn>).mock.calls;
      if (calls.length > 0) {
        expect(calls[0][0]).toBe(cacheKey);
      }
    });
  });

  test('should call onSave callback with note data on submit in create mode', async () => {
    const richTextEditorRef = React.createRef<RichTextEditorRef>();

    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        RichTextEditorRef={richTextEditorRef}
        ref={modalRef}
      />,
    );

    modalRef.current?.show({
      mode: 'create',
      entityId: 'entity-123',
      title: 'Test Note',
      content: '<p>Test content</p>',
      cacheKey: 'notes-entity-123',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: '',
      initialContent: '',
    });

    await waitFor(() => {
      expect(screen.getByText('Create Note')).toBeInTheDocument();
    });

    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);
    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });

    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'entity-123',
          title: 'Test Note',
          content: '<p>Test content</p>',
        }),
      );
    });
  });

  test('should include note id when in edit mode', async () => {
    const richTextEditorRef = React.createRef<RichTextEditorRef>();

    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        RichTextEditorRef={richTextEditorRef}
        ref={modalRef}
      />,
    );

    modalRef.current?.show({
      id: 'note-456',
      mode: 'edit',
      entityId: 'entity-123',
      title: 'Updated Note',
      content: '<p>Updated content</p>',
      cacheKey: 'notes-entity-123-note-456',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: 'Original Note',
      initialContent: '<p>Original content</p>',
    });

    await waitFor(() => {
      expect(screen.getByText('Edit Note')).toBeInTheDocument();
    });

    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);
    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });

    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'note-456',
          entityId: 'entity-123',
          title: 'Updated Note',
          content: '<p>Updated content</p>',
        }),
      );
    });
  });

  test('should disable Save button when title is missing', async () => {
    const richTextEditorRef = React.createRef<RichTextEditorRef>();

    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        RichTextEditorRef={richTextEditorRef}
        ref={modalRef}
      />,
    );

    modalRef.current?.show({
      mode: 'create',
      entityId: 'entity-123',
      title: '',
      content: '<p>Content only</p>',
      cacheKey: 'notes-entity-123',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: '',
      initialContent: '',
    });

    await waitFor(() => {
      expect(screen.getByText('Create Note')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId(SUBMIT_BUTTON_ID)).toBeDisabled();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  test('should disable Save button when content is missing', async () => {
    const richTextEditorRef = React.createRef<RichTextEditorRef>();

    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        RichTextEditorRef={richTextEditorRef}
        ref={modalRef}
      />,
    );

    modalRef.current?.show({
      mode: 'create',
      entityId: 'entity-123',
      title: 'Title only',
      content: '',
      cacheKey: 'notes-entity-123',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: '',
      initialContent: '',
    });

    await waitFor(() => {
      expect(screen.getByText('Create Note')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId(SUBMIT_BUTTON_ID)).toBeDisabled();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  test('should show error message when onSave fails', async () => {
    const failingOnSave = vi.fn().mockRejectedValue(new Error('Save failed'));
    const richTextEditorRef = React.createRef<RichTextEditorRef>();

    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={failingOnSave}
        onModalClosed={mockOnModalClosed}
        RichTextEditorRef={richTextEditorRef}
        ref={modalRef}
      />,
    );

    modalRef.current?.show({
      mode: 'create',
      entityId: 'entity-123',
      title: 'Test Note',
      content: '<p>Test content</p>',
      cacheKey: 'notes-entity-123',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: '',
      initialContent: '',
    });

    await waitFor(() => {
      expect(screen.getByText('Create Note')).toBeInTheDocument();
    });

    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);
    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });

    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('There was a problem submitting the note.')).toBeInTheDocument();
    });
  });

  test('should clear form on cancel', async () => {
    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        ref={modalRef}
      />,
    );

    modalRef.current?.show({
      mode: 'create',
      entityId: 'entity-123',
      title: 'Test Note',
      content: '<p>Test content</p>',
      cacheKey: 'notes-entity-123',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: '',
      initialContent: '',
    });

    await waitFor(() => {
      expect(screen.getByText('Discard')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Discard');
    cancelButton.click();

    await waitFor(() => {
      expect(LocalFormCache.clearForm).toHaveBeenCalled();
    });
  });

  test('should show validation error and throttle when content is cleared before submit', async () => {
    const richTextEditorRef = React.createRef<RichTextEditorRef>();

    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        RichTextEditorRef={richTextEditorRef}
        ref={modalRef}
      />,
    );

    modalRef.current?.show({
      mode: 'create',
      entityId: 'entity-123',
      title: 'Test Note',
      content: '<p>Test content</p>',
      cacheKey: 'notes-entity-123',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: '',
      initialContent: '',
    });

    await waitFor(() => {
      expect(screen.getByText('Create Note')).toBeInTheDocument();
    });

    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);
    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });

    // Clears contentRef.current synchronously; React state/useEffect updates are queued
    richTextEditorRef.current?.clearValue();

    // First click: throttle fires, validFields('Test Note', '') → false → lines 211-212, 221-222 hit
    fireEvent.click(submitButton);
    // Second click: isThrottled.current is still true → line 32 hit
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Title and content are both required inputs.')).toBeInTheDocument();
    });
  });

  test('should call onModalClosed when modal is closed', async () => {
    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        ref={modalRef}
      />,
    );

    modalRef.current?.show({
      mode: 'create',
      entityId: 'entity-123',
      title: 'Test Note',
      content: '<p>Test content</p>',
      cacheKey: 'notes-entity-123',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: '',
      initialContent: '',
    });

    await waitFor(() => {
      expect(screen.getByText('Create Note')).toBeInTheDocument();
    });

    modalRef.current?.hide();

    await waitFor(() => {
      expect(mockOnModalClosed).toHaveBeenCalled();
    });
  });
});
