import CaseNoteModal, {
  CaseNoteModalOpenProps,
  CaseNoteModalProps,
  CaseNoteModalRef,
} from './CaseNoteModal';
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
import { CaseNoteInput } from '@common/cams/cases';

const title = 'Test Case Note Title';
const content = 'Test Case Note Content';
const testCaseId = '000-11-22222';
const modalId = 'edit-modal';
const modalOpenButtonRef = React.createRef<OpenModalButtonRef>();
let session: CamsSession;

function renderWithProps(
  modalRef: React.RefObject<CaseNoteModalRef>,
  modalProps?: Partial<CaseNoteModalProps>,
  openProps?: Partial<CaseNoteModalOpenProps>,
) {
  const defaultModalProps = {
    modalId,
    ref: modalOpenButtonRef,
  };

  const defaultOpenProps = {
    caseId: testCaseId,
    callback: vi.fn(),
  };

  const modalRenderProps = { ...defaultModalProps, ...modalProps };
  const openRenderProps = { ...defaultOpenProps, ...openProps };
  render(
    <React.StrictMode>
      <BrowserRouter>
        <>
          <OpenModalButton
            modalId={modalId}
            modalRef={modalRef}
            openProps={openRenderProps}
            ref={modalOpenButtonRef}
          >
            Open Modal
          </OpenModalButton>
          <CaseNoteModal {...modalRenderProps} ref={modalRef} modalId={modalId} />
        </>
      </BrowserRouter>
    </React.StrictMode>,
  );
}

describe('case note tests', () => {
  beforeEach(() => {
    session = MockData.getCamsSession();
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function openWithExpectedContent(data: CaseNoteInput) {
    const modalRef = React.createRef<CaseNoteModalRef>();
    const noteOpenProps: Partial<CaseNoteModalOpenProps> = {
      id: data.id ?? undefined,
      caseId: data.caseId,
      title: data.title,
      content: data.content,
    };

    renderWithProps(modalRef, {}, noteOpenProps);

    const modal = screen.getByTestId(`modal-case-note-form`);
    expect(modal).not.toHaveClass('is-visible');
    const openButton = screen.getByTestId('open-modal-button');
    expect(openButton).toBeInTheDocument();

    await userEvent.click(openButton);
    expect(modal).toHaveClass('is-visible');

    const titleInput = screen.getByTestId('case-note-title-input');
    const contentInput = screen.getByTestId('textarea-note-content');

    expect(titleInput).toHaveValue(data.title);
    expect(contentInput).toHaveValue(data.content);

    return modal;
  }

  test('Should properly post new case note', async () => {
    const postNoteSpy = vi.spyOn(Api2, 'postCaseNote');
    postNoteSpy.mockResolvedValue();

    const modal = await openWithExpectedContent({
      caseId: testCaseId,
      title: '',
      content: '',
    });

    const titleInput = screen.getByTestId('case-note-title-input');
    const contentInput = screen.getByTestId('textarea-note-content');
    const editedNoteTitleText = 'Edited Note Title';
    const editedNoteContentText = 'Edited Note Content';

    await userEvent.type(titleInput, editedNoteTitleText);
    await userEvent.type(contentInput, editedNoteContentText);
    await userEvent.click(screen.getByTestId('button-case-note-form-submit-button'));

    await waitFor(() => {
      expect(modal).not.toHaveClass('is-visible');
    });
    expect(postNoteSpy).toHaveBeenCalledWith({
      title: editedNoteTitleText,
      content: editedNoteContentText,
      caseId: testCaseId,
      updatedBy: getCamsUserReference(session.user),
    });
  });

  test('Should properly put case note edit', async () => {
    const putNoteSpy = vi.spyOn(Api2, 'putCaseNote');
    putNoteSpy.mockResolvedValue();

    const editedNoteTitleText = 'Edited Note Title';
    const editedNoteContentText = 'Edited Note Content';
    const note = MockData.getCaseNote();

    const modal = await openWithExpectedContent({
      id: note.id,
      caseId: testCaseId,
      title: note.title,
      content: note.content,
    });

    const titleInput = screen.getByTestId('case-note-title-input');
    const contentInput = screen.getByTestId('textarea-note-content');

    await userEvent.type(titleInput, editedNoteTitleText);
    await userEvent.type(contentInput, editedNoteContentText);
    await userEvent.click(screen.getByTestId('button-case-note-form-submit-button'));
    await waitFor(() => {
      expect(modal).not.toHaveClass('is-visible');
    });
    expect(putNoteSpy).toHaveBeenCalled();
  });

  test('Should close when cancel is clicked', async () => {
    const modalRef = React.createRef<CaseNoteModalRef>();
    renderWithProps(modalRef);

    const modal = screen.getByTestId(`modal-case-note-form`);
    expect(modal).not.toHaveClass('is-visible');
    const openButton = screen.getByTestId('open-modal-button');
    expect(openButton).toBeInTheDocument();
    expect(modal).not.toHaveClass('is-visible');

    await userEvent.click(openButton);
    expect(modal).toHaveClass('is-visible');

    const titleInput = screen.getByTestId('case-note-title-input');
    await userEvent.type(titleInput, title);
    expect(titleInput).toHaveValue(title);
    const contentInput = screen.getByTestId('textarea-note-content');
    await userEvent.type(contentInput, content);
    expect(contentInput).toHaveValue(content);
    const cancelButton = screen.getByTestId('button-case-note-form-cancel-button');
    expect(cancelButton).toBeVisible();
    await userEvent.click(cancelButton);
    expect(modal).not.toHaveClass('is-visible');
  });

  test('Should display error and not close modal if error occurs submitting new case note', async () => {
    const editedNoteTitleText = 'Edited Note Title';
    const editedNoteContentText = 'Edited Note Content';

    const modalRef = React.createRef<CaseNoteModalRef>();
    const postSpy = vi.spyOn(Api2, 'postCaseNote').mockRejectedValue({});
    renderWithProps(modalRef);

    const modal = screen.getByTestId('modal-case-note-form');
    expect(modal).not.toHaveClass('is-visible');
    const openButton = screen.getByTestId('open-modal-button');
    expect(openButton).toBeInTheDocument();

    await userEvent.click(openButton);
    expect(modal).toHaveClass('is-visible');

    const titleInput = screen.getByTestId('case-note-title-input');
    const contentInput = screen.getByTestId('textarea-note-content');

    await userEvent.type(titleInput, editedNoteTitleText);
    await userEvent.type(contentInput, editedNoteContentText);
    await userEvent.click(screen.getByTestId('button-case-note-form-submit-button'));
    expect(postSpy).toHaveBeenCalled();
    const errorMessage = screen.getByTestId('alert-case-note-form-error');
    expect(errorMessage).toBeVisible();
    expect(modal).toHaveClass('is-visible');
  });

  test('Should display error and not close modal if error occurs submitting a case note edit', async () => {
    const editedNoteTitleText = 'Edited Note Title';
    const editedNoteContentText = 'Edited Note Content';

    const modalRef = React.createRef<CaseNoteModalRef>();
    const postSpy = vi.spyOn(Api2, 'putCaseNote').mockRejectedValue({});
    renderWithProps(
      modalRef,
      {},
      {
        id: randomUUID(),
        content: editedNoteContentText,
        title: editedNoteTitleText,
        caseId: '111-22-33333',
      },
    );

    const modal = screen.getByTestId('modal-case-note-form');
    expect(modal).not.toHaveClass('is-visible');
    const openButton = screen.getByTestId('open-modal-button');
    expect(openButton).toBeInTheDocument();

    await userEvent.click(openButton);
    expect(modal).toHaveClass('is-visible');

    const titleInput = screen.getByTestId('case-note-title-input');
    const contentInput = screen.getByTestId('textarea-note-content');

    await userEvent.type(titleInput, editedNoteTitleText);
    await userEvent.type(contentInput, editedNoteContentText);
    await userEvent.click(screen.getByTestId('button-case-note-form-submit-button'));
    expect(postSpy).toHaveBeenCalled();
    const errorMessage = screen.getByTestId('alert-case-note-form-error');
    expect(errorMessage).toBeVisible();
    expect(modal).toHaveClass('is-visible');
  });

  async function setUpAndLoadFromCache() {
    const note = MockData.getCaseNote();
    const modalRef = React.createRef<CaseNoteModalRef>();
    vi.spyOn(LocalFormCache, 'getForm').mockReturnValue({
      caseId: note.caseId,
      title: 'test title',
      content: 'test content',
    });
    const saveFormSpy = vi.spyOn(LocalFormCache, 'saveForm');
    const clearFormSpy = vi.spyOn(LocalFormCache, 'clearForm');
    const noteId = randomUUID();
    const noteOpenProps: Partial<CaseNoteModalOpenProps> = {
      id: noteId,
      caseId: note.caseId,
      title: '',
      content: '',
    };

    renderWithProps(modalRef, {}, noteOpenProps);

    const modal = screen.getByTestId(`modal-case-note-form`);
    const openButton = screen.getByTestId('open-modal-button');
    await userEvent.click(openButton);
    expect(modal).toHaveClass('is-visible');

    const input = document.querySelector('input');
    const textarea = document.querySelector('textarea');
    const submitBtn = screen.getByTestId('button-case-note-form-submit-button');

    expect(input).toHaveValue('test title');
    expect(textarea).toHaveValue('test content');

    const newTitle = 'new title';
    const newContent = 'new content';

    await userEvent.clear(input!);
    await userEvent.clear(textarea!);
    expect(clearFormSpy).toHaveBeenCalledTimes(1);

    await userEvent.click(input!);
    await userEvent.paste(newTitle);
    await userEvent.click(textarea!);
    await userEvent.paste(newContent);

    const expectedSaveContent = {
      caseId: note.caseId,
      title: newTitle,
      content: newContent,
    };

    expect(saveFormSpy).toHaveBeenCalled();
    const lastContent = saveFormSpy.mock.calls[saveFormSpy.mock.calls.length - 1];
    expect(lastContent.pop()).toEqual(expectedSaveContent);
    expect(submitBtn).toBeEnabled();
  }

  test('modal show method should set up form fields based on local form cache values when cache has existing values and then should clear fields after submitting modal', async () => {
    const putSpy = vi.spyOn(Api2, 'putCaseNote').mockResolvedValue();
    const clearFormSpy = vi.spyOn(LocalFormCache, 'clearForm');
    await setUpAndLoadFromCache();

    const submitButton = screen.getByTestId('button-case-note-form-submit-button');
    await userEvent.click(submitButton);

    expect(putSpy).toHaveBeenCalled();
    expect(clearFormSpy).toHaveBeenCalledTimes(2);
  });

  test('modal show method should set up form fields based on local form cache values when cache has existing values and then should clear fields after canceling modal', async () => {
    const putSpy = vi.spyOn(Api2, 'putCaseNote').mockResolvedValue();
    const clearFormSpy = vi.spyOn(LocalFormCache, 'clearForm');
    await setUpAndLoadFromCache();

    const cancelButton = screen.getByTestId('button-case-note-form-cancel-button');
    await userEvent.click(cancelButton);

    expect(putSpy).not.toHaveBeenCalled();
    expect(clearFormSpy).toHaveBeenCalledTimes(2);
  });

  // TODO: rewrite the following test to migrate from CaseNotes.tsx to CaseNoteModal.tsx
  /*
  test('should enable or disable buttons based on form input, and clear button action', async () => {
    vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: [] });
    vi.spyOn(Api2, 'postCaseNote').mockImplementation((): Promise<void> => Promise.resolve());
    let submitButton;
    let clearButton;
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    renderWithProps();

    const textArea = screen.getByTestId(textAreaTestId);
    expect(textArea).toBeInTheDocument();

    const noteTitleInput = screen.getByTestId(noteTitleInputTestId);
    expect(noteTitleInput).toBeInTheDocument();

    await userEvent.type(noteTitleInput, 'test note title');
    submitButton = screen.getByTestId('button-submit-case-note');
    clearButton = screen.getByTestId('button-clear-case-note');
    expect(submitButton).toBeEnabled();
    expect(clearButton).toBeEnabled();

    await userEvent.clear(noteTitleInput);
    expect(noteTitleInput).toHaveValue('');

    await waitFor(() => {
      submitButton = screen.getByTestId('button-submit-case-note');
      expect(submitButton).toBeDisabled();
    });
    clearButton = screen.getByTestId('button-clear-case-note');
    expect(clearButton).toBeDisabled();

    await userEvent.type(textArea, 'test note');
    await waitFor(() => {
      expect(setTimeoutSpy).toHaveBeenCalled();
    });
    await waitFor(() => {
      submitButton = screen.getByTestId('button-submit-case-note');
      expect(submitButton).toBeEnabled();
    });
    clearButton = screen.getByTestId('button-clear-case-note');
    expect(clearButton).toBeEnabled();

    await userEvent.clear(textArea);

    expect(textArea).toHaveValue('');

    await userEvent.clear(noteTitleInput);

    await waitFor(() => {
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    await waitFor(() => {
      submitButton = screen.getByTestId('button-submit-case-note');
      expect(submitButton).toBeDisabled();
    });
    clearButton = screen.getByTestId('button-clear-case-note');
    expect(clearButton).toBeDisabled();

    await userEvent.type(noteTitleInput, 'test note title');
    await userEvent.type(textArea, 'test note');
    await waitFor(() => {
      submitButton = screen.getByTestId('button-submit-case-note');
      expect(submitButton).toBeEnabled();
    });
    await userEvent.click(submitButton);
  });
  */
});
