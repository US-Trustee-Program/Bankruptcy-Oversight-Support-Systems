import CaseNoteFormModal, {
  CaseNoteFormModalOpenProps,
  CaseNoteFormModalProps,
  CaseNoteFormModalRef,
  CaseNoteFormMode,
  getCaseNotesTitleValue,
  buildCaseNoteFormKey,
} from './CaseNoteFormModal';
import { render, screen, waitFor } from '@testing-library/react';
import { OpenModalButton } from '@/lib/components/uswds/modal/OpenModalButton';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import userEvent from '@testing-library/user-event';
import Api2 from '@/lib/models/api2';
import { OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import MockData from '@common/cams/test-utilities/mock-data';
import LocalStorage from '@/lib/utils/local-storage';
import { getCamsUserReference } from '@common/cams/session';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import LocalFormCache from '@/lib/utils/local-form-cache';
import { CamsSession } from '@common/cams/session';
import { randomUUID } from 'crypto';

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
          setContent('<p><br class="ProseMirror-trailingBreak"></p>');
          props.onChange?.('');
        },
        getValue: () => content,
        getHtml: () => (isEmptyContent(content) ? '' : content),
        setValue: (value: string) => {
          if (!value || value.trim() === '') {
            const emptyContent = '<p><br class="ProseMirror-trailingBreak"></p>';
            setContent(emptyContent);
            props.onChange?.(emptyContent);
          } else if (value.startsWith('<')) {
            // Already HTML formatted
            setContent(value);
            props.onChange?.(value);
          } else {
            // Plain text - wrap in p tag like rich text editor does
            const wrappedContent = `<p>${value}</p>`;
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

      const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        const newContent = e.currentTarget.innerHTML;
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
const TITLE_INPUT_ID = 'case-note-title-input';
const CONTENT_INPUT_SELECTOR = '.rich-text-editor-container .editor-content';
const RICH_TEXT_CONTENT_INPUT_SELECTOR = '.editor-container .editor-content';
const OPEN_BUTTON_ID = 'open-modal-button';
const CANCEL_BUTTON_ID = 'button-case-note-form-cancel-button';
const SUBMIT_BUTTON_ID = 'button-case-note-form-submit-button';
const ERROR_MESSAGE = 'There was a problem submitting the case note.';
const TEST_CASE_ID = '000-11-22222';

// Helper function to get the correct content input based on feature flag
const getContentInput = () => {
  const mockFeatureFlags = {
    [FeatureFlagHook.FORMAT_CASE_NOTES]: true,
  };
  const isFeatureEnabled = mockFeatureFlags[FeatureFlagHook.FORMAT_CASE_NOTES];

  if (isFeatureEnabled) {
    // For mocked RichTextEditor, we can target the contentEditable div directly
    return document.querySelector(RICH_TEXT_CONTENT_INPUT_SELECTOR);
  }
  return document.querySelector(CONTENT_INPUT_SELECTOR);
};

/**
 * NOTE: We mock RichTextEditor to avoid jsdom/ProseMirror compatibility issues.
 * The mock provides the same interface as the real RichTextEditor but uses a simple
 * contentEditable div instead of ProseMirror.
 */

const renderComponent = (
  modalRef: React.RefObject<CaseNoteFormModalRef>,
  modalProps: Partial<CaseNoteFormModalProps> = {},
  openProps: Partial<CaseNoteFormModalOpenProps> = {},
  richTextEditorRef: React.RefObject<RichTextEditorRef> | undefined = undefined,
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
  let session: CamsSession;

  beforeEach(() => {
    vi.resetModules();
    session = MockData.getCamsSession();
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    vi.spyOn(LocalFormCache, 'getForm').mockReturnValue({ expiresAfter: 1, value: {} });
    const mockFeatureFlags = {
      [FeatureFlagHook.FORMAT_CASE_NOTES]: true,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should open modal when button is clicked', async () => {
    const modalRef = React.createRef<CaseNoteFormModalRef>();
    renderComponent(modalRef);

    const modal = screen.getByTestId(MODAL_ID);
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
    richTextEditorRef.current?.setValue(newContent);

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
    richTextEditorRef.current?.setValue(editedContent);

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

    const modal = screen.getByTestId(MODAL_ID);
    expect(modal).toHaveClass('is-visible');

    const titleInput = screen.getByTestId(TITLE_INPUT_ID);
    const contentInput = getContentInput();
    await userEvent.type(titleInput, 'Test Title');
    await userEvent.type(contentInput!, 'Test Content');

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
    const contentInput = getContentInput();
    await userEvent.type(titleInput, 'Test Title');
    await userEvent.type(contentInput!, 'Test Content');

    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);
    await userEvent.click(submitButton);

    expect(postSpy).toHaveBeenCalled();

    const errorMessage = screen.getByTestId('alert-message-case-note-form-error');
    expect(errorMessage).toBeVisible();
    expect(errorMessage).toHaveTextContent(ERROR_MESSAGE);

    const modal = screen.getByTestId(MODAL_ID);
    expect(modal).toHaveClass('is-visible');
  });

  test('should display error and not close modal if error occurs submitting a case note edit', async () => {
    const putSpy = vi.spyOn(Api2, 'putCaseNote').mockRejectedValue({});
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
    const contentInput = getContentInput();
    await userEvent.clear(titleInput);
    // For RichTextEditor, we need to clear content differently
    if (contentInput?.querySelector('.ProseMirror')) {
      await userEvent.click(contentInput);
      await userEvent.keyboard('{Control}a');
      await userEvent.keyboard('{Delete}');
    } else {
      await userEvent.clear(contentInput!);
    }
    await userEvent.type(titleInput, 'Edited Title');
    await userEvent.type(contentInput!, 'Edited Content');

    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);
    await userEvent.click(submitButton);

    expect(putSpy).toHaveBeenCalled();

    const errorMessage = screen.getByTestId('alert-case-note-form-error');
    expect(errorMessage).toBeVisible();
    expect(errorMessage).toHaveTextContent(ERROR_MESSAGE);

    const modal = screen.getByTestId(MODAL_ID);
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
    const contentInput = getContentInput();
    await userEvent.type(titleInput, 'Test Title');
    await userEvent.type(contentInput!, 'Test Content');

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
    const contentInput = getContentInput();
    await userEvent.type(titleInput, 'Draft Title');
    await userEvent.type(contentInput!, 'Draft Content');

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
    const contentInput = getContentInput();
    await userEvent.type(titleInput, 'Test Title');
    await userEvent.type(contentInput!, 'Test Content');

    const cancelButton = screen.getByTestId(CANCEL_BUTTON_ID);
    await userEvent.click(cancelButton);

    expect(clearFormSpy).toHaveBeenCalled();
  });

  test('should initialize form with provided values', async () => {
    const initialTitle = 'Initial Title';
    const initialContent = 'Initial Content';

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

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    const titleInput = screen.getByTestId(TITLE_INPUT_ID);
    const contentInput = getContentInput();

    expect(titleInput).toHaveValue(initialTitle);
    // RichTextEditor wraps content in HTML, so we need to check the editor content
    expect(contentInput?.innerHTML).toBe(`<p>${initialContent}</p>`);

    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
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

    richTextEditorRef.current?.setValue('Test Content');
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

  test.skip('should cache form data when typing', async () => {
    const newTitle = 'New Note Title';
    const newContent = 'New Note Content';
    // Put the form data in the cache BEFORE rendering/opening the modal
    LocalFormCache.saveForm(buildCaseNoteFormKey(TEST_CASE_ID, 'create', ''), {
      title: newTitle,
      content: newContent,
      caseId: TEST_CASE_ID,
    });

    const modalRef = React.createRef<CaseNoteFormModalRef>();
    const richTextEditorRef = React.createRef<RichTextEditorRef>();
    renderComponent(modalRef, {}, undefined, richTextEditorRef);

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    // Wait for form to rehydrate from cache
    await waitFor(() => {
      expect(screen.getByTestId(TITLE_INPUT_ID)).toHaveValue(newTitle);
      expect(richTextEditorRef.current?.getHtml()).toBe(`<p>${newContent}</p>`);
    });
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
    const contentInput = getContentInput();
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Edited Title');
    await userEvent.type(contentInput!, 'Edited Content');

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
    const contentInput = getContentInput();
    const newTitle = 'New Note Title';
    const newContent = 'New Note Content';

    await userEvent.type(titleInput, newTitle);
    await userEvent.type(contentInput!, newContent);

    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);
    await userEvent.click(submitButton);

    // Reopen modal
    await userEvent.click(openButton);

    // Check that form data is cleared
    expect(screen.getByTestId(TITLE_INPUT_ID)).toHaveValue('');
    // Check the editor content is cleared to empty state
    expect(getContentInput()?.innerHTML).toBe('<p><br class="ProseMirror-trailingBreak"></p>');
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
