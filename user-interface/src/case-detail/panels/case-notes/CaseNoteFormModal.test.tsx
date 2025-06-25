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
import { randomUUID } from 'crypto';
import LocalFormCache from '@/lib/utils/local-form-cache';
import { CamsSession, getCamsUserReference } from '@common/cams/session';
import { ZERO_WIDTH_SPACE } from '@/lib/components/cams/RichTextEditor/Editor.constants';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';

const MODAL_ID = 'modal-case-note-form';
const TITLE_INPUT_ID = 'case-note-title-input';
const CONTENT_INPUT_SELECTOR = '.rich-text-editor-container .editor-content';
const OPEN_BUTTON_ID = 'open-modal-button';
const CANCEL_BUTTON_ID = 'button-case-note-form-cancel-button';
const SUBMIT_BUTTON_ID = 'button-case-note-form-submit-button';
const ERROR_MESSAGE = 'There was a problem submitting the case note.';
const TEST_CASE_ID = '000-11-22222';

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

  const renderComponent = (
    modalRef: React.RefObject<CaseNoteFormModalRef>,
    modalProps: Partial<CaseNoteFormModalProps> = {},
    openProps: Partial<CaseNoteFormModalOpenProps> = {},
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
            <CaseNoteFormModal modalId={MODAL_ID} {...modalProps} ref={modalRef} />
          </>
        </BrowserRouter>
      </React.StrictMode>,
    );
  };

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
    renderComponent(modalRef);

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    const titleInput = screen.getByTestId(TITLE_INPUT_ID);
    const contentInput = document.querySelector(CONTENT_INPUT_SELECTOR);
    const newTitle = 'New Note Title';
    const newContent = 'New Note Content';
    const expectedContent = '<p>New Note Content</p>';

    await userEvent.type(titleInput, newTitle);
    await userEvent.type(contentInput!, newContent);

    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(postNoteSpy).toHaveBeenCalledWith({
        title: newTitle,
        content: expectedContent,
        caseId: TEST_CASE_ID,
        updatedBy: getCamsUserReference(session.user),
      });
    });

    const modal = screen.getByTestId(MODAL_ID);
    await waitFor(() => {
      expect(modal).not.toHaveClass('is-visible');
    });
  });

  test('should properly put case note edit', async () => {
    const putNoteSpy = vi.spyOn(Api2, 'putCaseNote');
    const note = MockData.getCaseNote();
    putNoteSpy.mockResolvedValue(note.id);

    const modalRef = React.createRef<CaseNoteFormModalRef>();
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
    );

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    const titleInput = screen.getByTestId(TITLE_INPUT_ID);
    const contentInput = document.querySelector(CONTENT_INPUT_SELECTOR);
    const editedTitle = 'Edited Note Title';
    const editedContent = 'Edited Note Content';

    await userEvent.clear(titleInput);
    await userEvent.clear(contentInput!);
    await userEvent.type(titleInput, editedTitle);
    await userEvent.type(contentInput!, editedContent);

    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(putNoteSpy).toHaveBeenCalledWith({
        id: note.id,
        title: editedTitle,
        content: `<p>${editedContent}</p>`,
        caseId: TEST_CASE_ID,
        updatedBy: getCamsUserReference(session.user),
      });
    });

    const modal = screen.getByTestId(MODAL_ID);
    await waitFor(() => {
      expect(modal).not.toHaveClass('is-visible');
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
    const contentInput = document.querySelector(CONTENT_INPUT_SELECTOR);
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
    const contentInput = document.querySelector(CONTENT_INPUT_SELECTOR);
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
    const contentInput = document.querySelector(CONTENT_INPUT_SELECTOR);
    await userEvent.clear(titleInput);
    await userEvent.clear(contentInput!);
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
    const contentInput = document.querySelector(CONTENT_INPUT_SELECTOR);
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
    const contentInput = document.querySelector(CONTENT_INPUT_SELECTOR);
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
    const contentInput = document.querySelector(CONTENT_INPUT_SELECTOR);
    await userEvent.type(titleInput, 'Test Title');
    await userEvent.type(contentInput!, 'Test Content');

    const cancelButton = screen.getByTestId(CANCEL_BUTTON_ID);
    await userEvent.click(cancelButton);

    expect(clearFormSpy).toHaveBeenCalled();
  });

  test('should disable Save button unless both Title and Content have non-empty values', async () => {
    const modalRef = React.createRef<CaseNoteFormModalRef>();
    renderComponent(modalRef);

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    const titleInput = screen.getByTestId(TITLE_INPUT_ID);
    const contentInput = document.querySelector(CONTENT_INPUT_SELECTOR);
    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);

    expect(titleInput).toHaveValue('');
    expect(contentInput!.innerHTML).toEqual(`<p>${ZERO_WIDTH_SPACE}</p>`);
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });

    await userEvent.type(titleInput, 'Test Title');
    expect(titleInput).toHaveValue('Test Title');
    expect(contentInput!.innerHTML).toEqual(`<p>${ZERO_WIDTH_SPACE}</p>`);
    expect(submitButton).toBeDisabled();

    await userEvent.clear(titleInput);
    await userEvent.click(contentInput!);
    await userEvent.type(contentInput!, 'Test Content');
    expect(titleInput).toHaveValue('');
    expect(contentInput!.innerHTML).toEqual(`<p>${ZERO_WIDTH_SPACE}Test Content</p>`);
    expect(submitButton).toBeDisabled();

    await userEvent.type(titleInput, 'Test Title');
    expect(titleInput).toHaveValue('Test Title');
    expect(contentInput!.innerHTML).toEqual(`<p>${ZERO_WIDTH_SPACE}Test Content</p>`);
    expect(submitButton).toBeEnabled();

    await userEvent.clear(titleInput);
    expect(titleInput).toHaveValue('');
    expect(contentInput!.innerHTML).toEqual(`<p>${ZERO_WIDTH_SPACE}Test Content</p>`);
    expect(submitButton).toBeDisabled();
  });

  test('should cache form data when typing', async () => {
    const saveFormSpy = vi.spyOn(LocalFormCache, 'saveForm');

    const modalRef = React.createRef<CaseNoteFormModalRef>();
    renderComponent(modalRef);

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    const titleInput = screen.getByTestId(TITLE_INPUT_ID);
    await userEvent.type(titleInput, 'Test Title');

    expect(saveFormSpy).toHaveBeenCalled();

    const contentInput = document.querySelector(CONTENT_INPUT_SELECTOR);
    await userEvent.type(contentInput!, 'Test Content');

    const lastCall = saveFormSpy.mock.calls[saveFormSpy.mock.calls.length - 1];
    expect(lastCall[1]).toEqual({
      caseId: TEST_CASE_ID,
      title: 'Test Title',
      content: '<p>Test Content</p>',
    });
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
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Edited Title');

    expect(saveFormSpy).toHaveBeenCalled();

    const lastCall = saveFormSpy.mock.calls[saveFormSpy.mock.calls.length - 1];
    expect(lastCall[0]).toContain(`-${noteId}`);
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
    const contentInput = document.querySelector(CONTENT_INPUT_SELECTOR);

    expect(titleInput).toHaveValue(initialTitle);
    expect(contentInput!.innerHTML).toEqual(initialContent);

    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });

  test('should clear form cache after successful submission', async () => {
    const postNoteSpy = vi.spyOn(Api2, 'postCaseNote');
    postNoteSpy.mockResolvedValue();

    const clearFormSpy = vi.spyOn(LocalFormCache, 'clearForm');

    const modalRef = React.createRef<CaseNoteFormModalRef>();
    renderComponent(modalRef);

    const openButton = screen.getByTestId(OPEN_BUTTON_ID);
    await userEvent.click(openButton);

    const titleInput = screen.getByTestId(TITLE_INPUT_ID);
    const contentInput = document.querySelector(CONTENT_INPUT_SELECTOR);
    await userEvent.type(titleInput, 'Test Title');
    await userEvent.type(contentInput!, 'Test Content');

    const submitButton = screen.getByTestId(SUBMIT_BUTTON_ID);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(clearFormSpy).toHaveBeenCalled();
    });

    const modal = screen.getByTestId(MODAL_ID);
    await waitFor(() => {
      expect(modal).not.toHaveClass('is-visible');
    });
  });
});
