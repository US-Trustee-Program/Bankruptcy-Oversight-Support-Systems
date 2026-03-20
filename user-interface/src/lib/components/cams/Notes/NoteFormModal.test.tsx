import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import NoteFormModal, { NoteFormModalRef } from './NoteFormModal';
import { NoteInput } from './types';
import React from 'react';
import LocalFormCache from '@/lib/utils/local-form-cache';
import userEvent from '@testing-library/user-event';
import { RichTextEditorRef } from '@/lib/components/cams/RichTextEditor/RichTextEditor';
import * as ModalModule from '@/lib/components/uswds/modal/Modal';

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

  afterEach(() => {
    vi.useRealTimers();
  });

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

    richTextEditorRef.current?.clearValue();

    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Title and content are both required inputs.')).toBeInTheDocument();
    });
  });

  test('should handle show and hide gracefully when modal ref is not set', async () => {
    type ModalRenderFn = (...args: unknown[]) => null;
    vi.spyOn(
      ModalModule.default as unknown as { render: ModalRenderFn },
      'render',
    ).mockImplementation(() => null);

    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        ref={modalRef}
      />,
    );

    // modalRef.current is null because Modal's render was mocked to null
    // This covers the false branches of `if (modalRef.current?.show)` and
    // `if (modalRef.current?.hide)`, plus the ?. null branches in show() and hide()
    expect(() =>
      modalRef.current?.show({
        mode: 'create',
        entityId: 'entity-123',
        title: 'Test',
        content: '<p>Content</p>',
        cacheKey: 'notes-entity-123',
        openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
        initialTitle: '',
        initialContent: '',
      }),
    ).not.toThrow();

    expect(() => modalRef.current?.hide()).not.toThrow();
  });

  test('should skip cache operations when form key is not yet set', async () => {
    render(<NoteFormModal modalId="test-note-modal" onSave={mockOnSave} ref={modalRef} />);

    // Trigger updateFormCache before show() so formKeyRef.current is still ''
    // This covers the saveFormData path where neither branch fires (falsy formKey)
    const titleInput = screen.getByTestId('note-title-input');
    fireEvent.change(titleInput, { target: { value: 'abc' } });

    expect(LocalFormCache.saveForm).not.toHaveBeenCalled();
    expect(LocalFormCache.clearForm).not.toHaveBeenCalled();
  });

  test('should fall back to empty string when getHtml returns null', async () => {
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

    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);
    await waitFor(() => expect(submitButton).toBeEnabled());

    // Make getHtml() return null to exercise the ?? '' fallback in both
    // getNotesRichTextContentValue (line 49) and updateFormCache (line 159)
    vi.spyOn(richTextEditorRef.current!, 'getHtml').mockReturnValue(null as unknown as string);

    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Title and content are both required inputs.')).toBeInTheDocument();
    });
  });

  test('should fall back to empty string when show is called with undefined title and content', async () => {
    render(<NoteFormModal modalId="test-note-modal" onSave={mockOnSave} ref={modalRef} />);

    // Pass undefined for title/content to exercise the ?? '' fallback in show()
    modalRef.current?.show({
      mode: 'create',
      entityId: 'entity-123',
      title: undefined as unknown as string,
      content: undefined as unknown as string,
      cacheKey: 'notes-entity-123',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: '',
      initialContent: '',
    });

    expect(await screen.findByText('Create Note')).toBeInTheDocument();
  });

  test('should use default modal ID when modalId prop is empty string', () => {
    render(<NoteFormModal modalId="" onSave={mockOnSave} ref={modalRef} />);
    expect(screen.getByTestId('modal-note-form-modal')).toBeInTheDocument();
  });

  test('should not throw when hide is called without onModalClosed', async () => {
    render(<NoteFormModal modalId="test-note-modal" onSave={mockOnSave} ref={modalRef} />);

    modalRef.current?.show({
      mode: 'create',
      entityId: 'entity-123',
      title: 'Test',
      content: '<p>Content</p>',
      cacheKey: 'notes-entity-123',
      openModalButtonRef: { focus: vi.fn(), disableButton: vi.fn() },
      initialTitle: '',
      initialContent: '',
    });

    expect(await screen.findByText('Create Note')).toBeInTheDocument();

    expect(() => modalRef.current?.hide()).not.toThrow();
  });

  test('should clear form cache when form key is set but both title and content are empty', async () => {
    render(
      <NoteFormModal
        modalId="test-note-modal"
        onSave={mockOnSave}
        onModalClosed={mockOnModalClosed}
        ref={modalRef}
      />,
    );

    // Showing with empty title and content: Input.getValue() returns its initial
    // state (''), RichTextEditor.getHtml() returns '' for empty content —
    // so updateFormCache sees both as '' and hits saveFormData's else-if branch.
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
      expect(LocalFormCache.clearForm).toHaveBeenCalledWith('notes-entity-123');
    });
  });

  test('should block second submission via throttle guard and reset timer after delay', async () => {
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

    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);
    await waitFor(() => expect(submitButton).toBeEnabled());

    // Switch to fake timers so the throttle's setTimeout(cb, 300) doesn't auto-fire
    vi.useFakeTimers();

    // First click: throttle fires, onSave rejects, finally re-enables button.
    // act(async) is required here to flush the Promise rejection microtask so
    // the finally block runs and re-enables the button before the second click.
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      fireEvent.click(submitButton);
    });

    // isThrottled.current is still true (setTimeout frozen); button re-enabled by finally
    // Second click: hits the throttle guard (line 32)
    fireEvent.click(submitButton);

    expect(failingOnSave).toHaveBeenCalledTimes(1);

    // Advance frozen timer to reset throttle (line 39)
    vi.advanceTimersByTime(300);

    vi.useRealTimers();
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
