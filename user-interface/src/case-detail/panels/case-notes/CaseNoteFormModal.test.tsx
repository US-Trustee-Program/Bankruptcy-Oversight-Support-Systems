import CaseNoteFormModal, {
  CaseNoteFormModalOpenProps,
  CaseNoteFormModalProps,
  CaseNoteFormModalRef,
  CaseNoteFormMode,
  getCaseNotesTitleValue,
  buildCaseNoteFormKey,
} from './CaseNoteFormModal';
import { CaseNoteInput } from '@common/cams/cases';
import { act, render, screen, waitFor } from '@testing-library/react';
import OpenModalButton from '@/lib/components/uswds/modal/OpenModalButton';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import Api2 from '@/lib/models/api2';
import { OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import MockData from '@common/cams/test-utilities/mock-data';
import LocalStorage from '@/lib/utils/local-storage';
import { getCamsUserReference } from '@common/cams/session';
import LocalFormCache from '@/lib/utils/local-form-cache';
import { randomUUID } from 'crypto';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

interface RichTextEditorRef {
  clearValue: () => void;
  getValue: () => string;
  getHtml: () => string;
  setValue: (value: string) => void;
  disable: (value: boolean) => void;
  focus: () => void;
}

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

      // Helper function to check if content is effectively empty
      const isEmptyContent = (content: string) => {
        return (
          !content ||
          content === '<p><br class="ProseMirror-trailingBreak"></p>' ||
          content === '<p></p>' ||
          content.trim() === ''
        );
      };

      React.useImperativeHandle(ref, () => ({
        clearValue: () => {
          const emptyContent = '<p><br class="ProseMirror-trailingBreak"></p>';
          contentRef.current = emptyContent;
          setContent(emptyContent);
          props.onChange?.('');
        },
        getValue: () => contentRef.current,
        getHtml: () => (isEmptyContent(contentRef.current) ? '' : contentRef.current),
        setValue: (value: string) => {
          if (!value || value.trim() === '') {
            const emptyContent = '<p><br class="ProseMirror-trailingBreak"></p>';
            contentRef.current = emptyContent;
            setContent(emptyContent);
            props.onChange?.(emptyContent);
          } else if (value.startsWith('<')) {
            // Already HTML formatted
            contentRef.current = value;
            setContent(value);
            props.onChange?.(value);
          } else {
            // Plain text - wrap in p tag like rich text editor does
            const wrappedContent = `<p>${value}</p>`;
            contentRef.current = wrappedContent;
            setContent(wrappedContent);
            props.onChange?.(wrappedContent);
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

      const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        const newContent = e.currentTarget.innerHTML;
        contentRef.current = newContent;
        setContent(newContent);
        props.onChange?.(newContent);
      };

      return React.createElement(
        'div',
        { className: 'usa-form-group editor-container', id: `${props.id}-container` },
        props.label &&
          React.createElement(
            'label',
            {
              id: `editor-label-${props.id}`,
              className: 'usa-label',
            },
            props.label,
            props.required && React.createElement('span', { className: 'required-form-field' }),
          ),
        React.createElement(
          'div',
          { className: 'editor-wrapper' },
          React.createElement(
            'div',
            { className: 'editor-toolbar' },
            React.createElement(
              'button',
              { type: 'button', 'aria-label': 'Bold', title: 'Bold' },
              'B',
            ),
            React.createElement(
              'button',
              { type: 'button', 'aria-label': 'Italic', title: 'Italic' },
              'I',
            ),
            React.createElement(
              'button',
              { type: 'button', 'aria-label': 'Underline', title: 'Underline' },
              'U',
            ),
          ),
          React.createElement('div', {
            className: 'editor-content editor',
            'data-testid': 'editor-content',
            contentEditable: !disabled,
            onInput: handleInput,
            dangerouslySetInnerHTML: { __html: content },
          }),
        ),
      );
    },
  );

  MockRichTextEditor.displayName = 'MockRichTextEditor';

  return {
    default: MockRichTextEditor,
    RichTextEditor: MockRichTextEditor,
  };
});

const MODAL_ID = 'modal-case-note-form';
const MODAL_WRAPPER_ID = `modal-${MODAL_ID}`;
const TITLE_INPUT_ID = 'case-note-title-input';
const RICH_TEXT_CONTENT_INPUT_ID = 'editor-content';
const OPEN_BUTTON_ID = 'open-modal-button';
const CANCEL_BUTTON_ID = `button-${MODAL_ID}-cancel-button`;
const SUBMIT_BUTTON_ID = `button-${MODAL_ID}-submit-button`;
const ERROR_MESSAGE = 'There was a problem submitting the case note.';
const TEST_CASE_ID = '000-11-22222';

/**
 * NOTE: We mock RichTextEditor to avoid jsdom/ProseMirror compatibility issues.
 * The mock provides the same interface as the real RichTextEditor but uses a simple
 * contentEditable div instead of ProseMirror.
 */

const renderComponent = (
  modalRef: React.RefObject<CaseNoteFormModalRef | null>,
  modalProps: Partial<CaseNoteFormModalProps> = {},
  openProps: Partial<CaseNoteFormModalOpenProps> = {},
  richTextEditorRef: React.RefObject<RichTextEditorRef | null> | undefined = undefined,
) => {
  const defaultOpenProps = {
    caseId: TEST_CASE_ID,
    callback: vi.fn(),
    title: '',
    content: '',
    initialTitle: '',
    initialContent: '',
    mode: 'create',
  };

  const openRenderProps = { ...defaultOpenProps, ...openProps };
  const modalOpenButtonRef = React.createRef<OpenModalButtonRef>();

  return render(
    <React.StrictMode>
      <BrowserRouter>
        <>
          <OpenModalButton
            modalId={MODAL_ID}
            modalRef={modalRef}
            openProps={openRenderProps}
            ref={modalOpenButtonRef}
          >
            Open Modal
          </OpenModalButton>
          <CaseNoteFormModal
            modalId={MODAL_ID}
            {...modalProps}
            ref={modalRef}
            RichTextEditorRef={richTextEditorRef}
          />
        </>
      </BrowserRouter>
    </React.StrictMode>,
  );
};

describe('CaseNoteFormModal - Simple Tests', () => {
  const session = MockData.getCamsSession();
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
    vi.resetModules();
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    vi.spyOn(LocalFormCache, 'getForm').mockReturnValue({ expiresAfter: 1, value: {} });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should open modal when button is clicked', async () => {
    const modalRef = React.createRef<CaseNoteFormModalRef>();
    renderComponent(modalRef);

    const modal = screen.getByTestId(MODAL_WRAPPER_ID);
    expect(modal).not.toHaveClass('is-visible');

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    expect(modal).toHaveClass('is-visible');
  });

  test('should properly post new case note', async () => {
    const postNoteSpy = vi.spyOn(Api2, 'postCaseNote');
    postNoteSpy.mockResolvedValue();

    const modalRef = React.createRef<CaseNoteFormModalRef>();
    const richTextEditorRef = React.createRef<RichTextEditorRef>();
    renderComponent(modalRef, {}, undefined, richTextEditorRef);

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    const titleInput = screen.getByTestId(TITLE_INPUT_ID);
    const newTitle = 'New Note Title';
    const newContent = 'New Note Content';
    const expectedContent = '<p>New Note Content</p>';

    await userEvent.type(titleInput, newTitle);
    act(() => richTextEditorRef.current?.setValue(newContent));

    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);
    await waitFor(() => {
      expect(richTextEditorRef.current?.getHtml()).toBe('<p>New Note Content</p>');
      expect(submitButton).toBeEnabled();
    });
    await userEvent.click(submitButton);

    expect(postNoteSpy).toHaveBeenCalledWith({
      title: newTitle,
      content: expectedContent,
      caseId: TEST_CASE_ID,
      updatedBy: getCamsUserReference(session.user),
    });
  });

  test('should properly put case note edit', async () => {
    const putNoteSpy = vi.spyOn(Api2, 'putCaseNote');
    const note = MockData.getCaseNote();
    putNoteSpy.mockResolvedValue(note.id);

    const modalRef = React.createRef<CaseNoteFormModalRef>();
    const richTextEditorRef = React.createRef<RichTextEditorRef>();
    renderComponent(
      modalRef,
      {},
      {
        id: note.id,
        caseId: TEST_CASE_ID,
        title: note.title,
        content: note.content,
        mode: 'edit',
      },
      richTextEditorRef,
    );

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    const titleInput = screen.getByTestId(TITLE_INPUT_ID);
    const editedTitle = 'Edited Note Title';
    const editedContent = 'Edited Note Content';
    const expectedContent = '<p>Edited Note Content</p>';

    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, editedTitle);
    act(() => richTextEditorRef.current?.setValue(editedContent));

    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);
    await waitFor(() => {
      expect(richTextEditorRef.current?.getHtml()).toBe('<p>Edited Note Content</p>');
      expect(submitButton).toBeEnabled();
    });
    await userEvent.click(submitButton);

    expect(putNoteSpy).toHaveBeenCalledWith({
      id: note.id,
      title: editedTitle,
      content: expectedContent,
      caseId: TEST_CASE_ID,
      updatedBy: getCamsUserReference(session.user),
    });
  });

  test('should close when cancel is clicked', async () => {
    const modalRef = React.createRef<CaseNoteFormModalRef>();
    renderComponent(modalRef);

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    const modal = screen.getByTestId(MODAL_WRAPPER_ID);
    expect(modal).toHaveClass('is-visible');

    const titleInput = screen.getByTestId(TITLE_INPUT_ID);
    const contentInput = screen.getByTestId(RICH_TEXT_CONTENT_INPUT_ID);
    await userEvent.type(titleInput, 'Test Title');
    await userEvent.type(contentInput, 'Test Content');

    const cancelButton = screen.getByTestId(CANCEL_BUTTON_ID);
    await userEvent.click(cancelButton);

    expect(modal).not.toHaveClass('is-visible');
  });

  test('should display error and not close modal if error occurs submitting new case note', async () => {
    const postSpy = vi.spyOn(Api2, 'postCaseNote').mockRejectedValue({});

    const modalRef = React.createRef<CaseNoteFormModalRef>();
    renderComponent(modalRef);

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    const titleInput = screen.getByTestId(TITLE_INPUT_ID);
    const contentInput = screen.getByTestId(RICH_TEXT_CONTENT_INPUT_ID);
    await userEvent.type(titleInput, 'Test Title');
    await userEvent.type(contentInput, 'Test Content');

    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);
    await userEvent.click(submitButton);

    expect(postSpy).toHaveBeenCalled();

    const errorMessage = screen.getByTestId('alert-message-case-note-form-error');
    expect(errorMessage).toBeVisible();
    expect(errorMessage).toHaveTextContent(ERROR_MESSAGE);

    const modal = screen.getByTestId(MODAL_WRAPPER_ID);
    expect(modal).toHaveClass('is-visible');
  });

  test('should display error and not close modal if error occurs submitting a case note edit', async () => {
    const putSpy = vi.spyOn(Api2, 'putCaseNote').mockRejectedValue({});
    const noteId = randomUUID();

    const modalRef = React.createRef<CaseNoteFormModalRef>();
    renderComponent(
      modalRef,
      {
        modalId: MODAL_ID,
      },
      {
        id: noteId,
        caseId: TEST_CASE_ID,
        title: 'Original Title',
        content: 'Original Content',
        mode: 'edit',
      },
    );

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    const titleInput = screen.getByTestId(TITLE_INPUT_ID);
    const contentInput = screen.getByTestId(RICH_TEXT_CONTENT_INPUT_ID);
    await userEvent.clear(titleInput);
    // For RichTextEditor, we need to clear content differently
    if (contentInput?.querySelector('.ProseMirror')) {
      await userEvent.click(contentInput);
      await userEvent.keyboard('{Control}a');
      await userEvent.keyboard('{Delete}');
    } else {
      await userEvent.clear(contentInput);
    }
    await userEvent.type(titleInput, 'Edited Title');
    await userEvent.type(contentInput, 'Edited Content');

    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);
    await userEvent.click(submitButton);

    expect(putSpy).toHaveBeenCalled();

    const errorMessage = screen.getByTestId('alert-case-note-form-error');
    expect(errorMessage).toBeVisible();
    expect(errorMessage).toHaveTextContent(ERROR_MESSAGE);

    const modal = screen.getByTestId(MODAL_WRAPPER_ID);
    expect(modal).toHaveClass('is-visible');
  });

  test('should call onModalClosed callback when modal closes after successful submission', async () => {
    const onModalClosedSpy = vi.fn();
    const postNoteSpy = vi.spyOn(Api2, 'postCaseNote');
    postNoteSpy.mockResolvedValue();

    const modalRef = React.createRef<CaseNoteFormModalRef>();
    renderComponent(modalRef, { onModalClosed: onModalClosedSpy });

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    const titleInput = screen.getByTestId(TITLE_INPUT_ID);
    const contentInput = screen.getByTestId(RICH_TEXT_CONTENT_INPUT_ID);
    await userEvent.type(titleInput, 'Test Title');
    await userEvent.type(contentInput, 'Test Content');

    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(onModalClosedSpy).toHaveBeenCalledWith(TEST_CASE_ID, 'create');
    });
  });

  test('should call onModalClosed callback when modal closes after cancellation', async () => {
    const onModalClosedSpy = vi.fn();

    const modalRef = React.createRef<CaseNoteFormModalRef>();
    renderComponent(modalRef, { onModalClosed: onModalClosedSpy });

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    const titleInput = screen.getByTestId(TITLE_INPUT_ID);
    const contentInput = screen.getByTestId(RICH_TEXT_CONTENT_INPUT_ID);
    await userEvent.type(titleInput, 'Draft Title');
    await userEvent.type(contentInput, 'Draft Content');

    const cancelButton = screen.getByTestId(CANCEL_BUTTON_ID);
    await userEvent.click(cancelButton);

    expect(onModalClosedSpy).toHaveBeenCalledWith(TEST_CASE_ID, 'create');
  });

  test('should clear form cache when modal is cancelled', async () => {
    const clearFormSpy = vi.spyOn(LocalFormCache, 'clearForm');

    const modalRef = React.createRef<CaseNoteFormModalRef>();
    renderComponent(modalRef);

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    const titleInput = screen.getByTestId(TITLE_INPUT_ID);
    const contentInput = screen.getByTestId(RICH_TEXT_CONTENT_INPUT_ID);
    await userEvent.type(titleInput, 'Test Title');
    await userEvent.type(contentInput, 'Test Content');

    const cancelButton = screen.getByTestId(CANCEL_BUTTON_ID);
    await userEvent.click(cancelButton);

    expect(clearFormSpy).toHaveBeenCalled();
  });

  test('should initialize form with provided values', async () => {
    const initialTitle = 'Initial Title';
    const initialContent = '<p>Initial Content</p>';

    const modalRef = React.createRef<CaseNoteFormModalRef>();
    renderComponent(
      modalRef,
      {},
      {
        caseId: TEST_CASE_ID,
        title: initialTitle,
        content: initialContent,
        initialTitle: initialTitle,
        initialContent: initialContent,
        mode: 'create',
      },
    );

    expect(screen.getByTestId(SUBMIT_BUTTON_ID)).toBeDisabled();

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    const titleInput = screen.getByTestId(TITLE_INPUT_ID);
    const contentInput = screen.getByTestId(RICH_TEXT_CONTENT_INPUT_ID);

    expect(contentInput).toBeInTheDocument();
    expect(contentInput.innerHTML).toEqual(initialContent);
    expect(titleInput).toHaveValue(initialTitle);

    await waitFor(() => {
      expect(screen.getByTestId(SUBMIT_BUTTON_ID)).toBeDisabled();
    });
  });

  test('should disable Save button unless both Title and Content have non-empty values', async () => {
    const modalRef = React.createRef<CaseNoteFormModalRef>();
    const richTextEditorRef = React.createRef<RichTextEditorRef>();
    renderComponent(modalRef, {}, undefined, richTextEditorRef);

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    const titleInput = screen.getByTestId(TITLE_INPUT_ID);
    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);

    expect(titleInput).toHaveValue('');
    await waitFor(() => {
      expect(richTextEditorRef.current?.getHtml()).toBe('');
    });
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });

    await userEvent.type(titleInput, 'Test Title');
    expect(titleInput).toHaveValue('Test Title');
    expect(richTextEditorRef.current?.getHtml()).toBe('');
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });

    act(() => richTextEditorRef.current?.setValue('Test Content'));
    await waitFor(() => {
      expect(richTextEditorRef.current?.getHtml()).toBe('<p>Test Content</p>');
      expect(submitButton).toBeEnabled();
    });

    expect(titleInput).toHaveValue('Test Title');

    await userEvent.clear(titleInput);
    expect(titleInput).toHaveValue('');
    expect(richTextEditorRef.current?.getHtml()).toBe('<p>Test Content</p>');
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });

  test('should cache form data when typing', async () => {
    const newTitle = 'New Note Title';
    const newContent = 'New Note Content';

    const openModalProps: Partial<CaseNoteFormModalOpenProps> = {
      title: newTitle,
      content: newContent,
      caseId: TEST_CASE_ID,
      mode: 'create',
    };

    const modalRef = React.createRef<CaseNoteFormModalRef>();
    const richTextEditorRef = React.createRef<RichTextEditorRef>();
    renderComponent(modalRef, {}, openModalProps, richTextEditorRef);

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    // Wait for form to rehydrate from cache
    await waitFor(() => {
      expect(screen.getByTestId(TITLE_INPUT_ID)).toHaveValue(newTitle);
      expect(richTextEditorRef.current?.getHtml()).toBe(`<p>${newContent}</p>`);
    });
  });

  test('should cache unsanitized content while typing but send sanitized content to API', async () => {
    const saveFormSpy = vi.spyOn(LocalFormCache, 'saveForm');
    const postNoteSpy = vi.spyOn(Api2, 'postCaseNote');
    postNoteSpy.mockResolvedValue();

    const modalRef = React.createRef<CaseNoteFormModalRef>();
    const richTextEditorRef = React.createRef<RichTextEditorRef>();
    renderComponent(modalRef, {}, undefined, richTextEditorRef);

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    const titleInput = screen.getByTestId(TITLE_INPUT_ID);
    const maliciousTitle = 'Title<script>alert("xss")</script>';
    const maliciousContent = '<p>Content</p><script>alert("xss")</script>';

    await userEvent.type(titleInput, maliciousTitle);
    act(() => richTextEditorRef.current?.setValue(maliciousContent)); // TODO: why ise setValues when we can .type

    // Verify unsanitized content is cached
    await waitFor(() => {
      expect(saveFormSpy).toHaveBeenCalled();
    });

    const lastCacheCall = saveFormSpy.mock.calls[saveFormSpy.mock.calls.length - 1];
    const cachedData = lastCacheCall[1] as CaseNoteInput;
    expect(cachedData.title).toEqual(maliciousTitle);
    expect(cachedData.content).toEqual(maliciousContent);

    // Submit the form
    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);
    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });
    await userEvent.click(submitButton);

    // Verify sanitized content is sent to API
    await waitFor(() => {
      expect(postNoteSpy).toHaveBeenCalled();
    });

    const apiCall = postNoteSpy.mock.calls[0][0];
    expect(apiCall.title).not.toContain('<script>');
    expect(apiCall.content).not.toContain('<script>');
    expect(apiCall.title).toBe('Title');
    expect(apiCall.content).toBe('<p>Content</p>');
  });

  test('should show edit note draft alert', async () => {
    const saveFormSpy = vi.spyOn(LocalFormCache, 'saveForm');
    const noteId = randomUUID();

    const modalRef = React.createRef<CaseNoteFormModalRef>();
    renderComponent(
      modalRef,
      {},
      {
        id: noteId,
        caseId: TEST_CASE_ID,
        title: 'Original Title',
        content: 'Original Content',
        mode: 'edit',
      },
    );

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    const titleInput = screen.getByTestId(TITLE_INPUT_ID);
    const contentInput = screen.getByTestId(RICH_TEXT_CONTENT_INPUT_ID);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Edited Title');
    await userEvent.type(contentInput, 'Edited Content');

    expect(saveFormSpy).toHaveBeenCalled();

    const lastCall = saveFormSpy.mock.calls[saveFormSpy.mock.calls.length - 1];
    expect(lastCall[0]).toContain(`-${noteId}`);
  });

  test('should clear form cache after successful submission', async () => {
    const postNoteSpy = vi.spyOn(Api2, 'postCaseNote');
    postNoteSpy.mockResolvedValue();

    const modalRef = React.createRef<CaseNoteFormModalRef>();
    renderComponent(modalRef);

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    const titleInput = screen.getByTestId(TITLE_INPUT_ID);
    const contentInput = screen.getByTestId(RICH_TEXT_CONTENT_INPUT_ID);
    const newTitle = 'New Note Title';
    const newContent = 'New Note Content';

    await userEvent.type(titleInput, newTitle);
    await userEvent.type(contentInput, newContent);

    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);
    await userEvent.click(submitButton);

    // Reopen modal
    await userEvent.click(openButton);

    // Check that form data is cleared
    expect(screen.getByTestId(TITLE_INPUT_ID)).toHaveValue('');
    // Check the editor content is cleared to empty state
    expect(screen.getByTestId(RICH_TEXT_CONTENT_INPUT_ID).innerHTML).toBe(
      '<p><br class="ProseMirror-trailingBreak"></p>',
    );
  });

  test('getCaseNotesInputValue should default to empty string if no ref passed', () => {
    const result = getCaseNotesTitleValue(null);
    expect(result).toEqual('');
  });

  const modeCases: { mode: CaseNoteFormMode }[] = [{ mode: 'create' }, { mode: 'edit' }];
  test.each(modeCases)(
    'should call close callback with $mode mode',
    async (args: { mode: CaseNoteFormMode }) => {
      const { mode } = args;
      const onModalClosedSpy = vi.fn();
      const modalRef = React.createRef<CaseNoteFormModalRef>();
      renderComponent(
        modalRef,
        { onModalClosed: onModalClosedSpy },
        { id: mode === 'edit' ? '123' : undefined, mode },
      );

      const openButton = screen.getByTestId(OPEN_BUTTON_ID);
      await userEvent.click(openButton);
      const cancelButton = screen.getByTestId(CANCEL_BUTTON_ID);
      expect(cancelButton).toBeVisible();
      await userEvent.click(cancelButton);
      expect(onModalClosedSpy).toHaveBeenCalledWith(TEST_CASE_ID, mode);
    },
  );

  test('buildCaseNoteFormKey should generate correct key for create mode', () => {
    const caseId = '123-45-67890';
    const mode = 'create';
    const id = '';
    const key = buildCaseNoteFormKey(caseId, mode, id);
    expect(key).toBe('case-notes-123-45-67890');
  });

  test('buildCaseNoteFormKey should generate correct key for edit mode', () => {
    const caseId = '123-45-67890';
    const mode = 'edit';
    const id = 'note-id-123';
    const key = buildCaseNoteFormKey(caseId, mode, id);
    expect(key).toBe('case-notes-123-45-67890-note-id-123');
  });
});
