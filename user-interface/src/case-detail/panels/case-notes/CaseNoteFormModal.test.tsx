import CaseNoteFormModal, {
  CaseNoteFormModalOpenProps,
  CaseNoteFormModalProps,
  CaseNoteFormModalRef,
  getCaseNotesInputValue,
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
import { CaseNoteInput } from '@common/cams/cases';

const title = 'Test Case Note Title';
const content = 'Test Case Note Content';
const testCaseId = '000-11-22222';
const titleInputId = 'case-note-title-input';
const contentInputId = 'textarea-note-content';
const openModalButtonId = 'open-modal-button';
const modalId = 'modal-case-note-form';
const cancelButtonId = 'button-case-note-form-cancel-button';
const submitButtonId = 'button-case-note-form-submit-button';
const notesRequiredFieldsMessage = 'Title and content are both required inputs.';
const notesSubmissionErrorMessage = 'There was a problem submitting the case note.';

const modalOpenButtonRef = React.createRef<OpenModalButtonRef>();
let session: CamsSession;

function renderWithProps(
  modalRef: React.RefObject<CaseNoteFormModalRef>,
  modalProps?: Partial<CaseNoteFormModalProps>,
  openProps?: Partial<CaseNoteFormModalOpenProps>,
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
          <CaseNoteFormModal {...modalRenderProps} ref={modalRef} modalId={modalId} />
        </>
      </BrowserRouter>
    </React.StrictMode>,
  );
}

async function openWithExpectedContent(data: CaseNoteInput) {
  const modalRef = React.createRef<CaseNoteFormModalRef>();
  const noteOpenProps: Partial<CaseNoteFormModalOpenProps> = {
    id: data.id ?? undefined,
    caseId: data.caseId,
    title: data.title,
    content: data.content,
  };

  renderWithProps(modalRef, {}, noteOpenProps);

  const modal = screen.getByTestId(modalId);
  expect(modal).not.toHaveClass('is-visible');
  const openButton = screen.getByTestId(openModalButtonId);
  expect(openButton).toBeInTheDocument();

  await userEvent.click(openButton);
  expect(modal).toHaveClass('is-visible');

  const titleInput = screen.getByTestId(titleInputId);
  const contentInput = screen.getByTestId(contentInputId);

  expect(titleInput).toHaveValue(data.title);
  expect(contentInput).toHaveValue(data.content);

  return modal;
}

async function setUpAndLoadFromCache(cachedTitle: string, cachedContent: string) {
  const note = MockData.getCaseNote();
  const modalRef = React.createRef<CaseNoteFormModalRef>();
  vi.spyOn(LocalFormCache, 'getForm').mockReturnValue({
    value: {
      caseId: note.caseId,
      title: cachedTitle,
      content: cachedContent,
    },
    expiresAfter: 1,
  });
  const saveFormSpy = vi.spyOn(LocalFormCache, 'saveForm');
  const clearFormSpy = vi.spyOn(LocalFormCache, 'clearForm');
  const noteId = randomUUID();
  const noteOpenProps: Partial<CaseNoteFormModalOpenProps> = {
    id: noteId,
    caseId: note.caseId,
    title: '',
    content: '',
  };

  renderWithProps(modalRef, {}, noteOpenProps);

  const modal = screen.getByTestId(`modal-case-note-form`);
  const openButton = screen.getByTestId(openModalButtonId);
  await userEvent.click(openButton);
  expect(modal).toHaveClass('is-visible');

  const input = document.querySelector('input');
  const textarea = document.querySelector('textarea');
  const submitBtn = screen.getByTestId(submitButtonId);

  expect(input).toHaveValue(cachedTitle);
  expect(textarea).toHaveValue(cachedContent);

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

describe('case note tests', () => {
  beforeEach(() => {
    vi.resetModules();
    session = MockData.getCamsSession();
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    vi.spyOn(LocalFormCache, 'getForm').mockReturnValue({ expiresAfter: 1, value: {} });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('Should properly post new case note', async () => {
    const postNoteSpy = vi.spyOn(Api2, 'postCaseNote');
    postNoteSpy.mockResolvedValue();

    const modal = await openWithExpectedContent({
      caseId: testCaseId,
      title: '',
      content: '',
    });

    const titleInput = screen.getByTestId(titleInputId);
    const contentInput = screen.getByTestId(contentInputId);
    const editedNoteTitleText = 'Edited Note Title';
    const editedNoteContentText = 'Edited Note Content';

    await userEvent.type(titleInput, editedNoteTitleText);
    await userEvent.type(contentInput, editedNoteContentText);
    await userEvent.click(screen.getByTestId(submitButtonId));

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

    const editedNoteTitleText = 'Edited Note Title';
    const editedNoteContentText = 'Edited Note Content';
    const note = MockData.getCaseNote();
    putNoteSpy.mockResolvedValue(note.id);

    const modal = await openWithExpectedContent({
      id: note.id,
      caseId: testCaseId,
      title: note.title,
      content: note.content,
    });

    const titleInput = screen.getByTestId(titleInputId);
    const contentInput = screen.getByTestId(contentInputId);

    await userEvent.type(titleInput, editedNoteTitleText);
    await userEvent.type(contentInput, editedNoteContentText);
    await userEvent.click(screen.getByTestId(submitButtonId));
    await waitFor(() => {
      expect(modal).not.toHaveClass('is-visible');
    });
    expect(putNoteSpy).toHaveBeenCalled();
  });

  test('Should close when cancel is clicked', async () => {
    const modalRef = React.createRef<CaseNoteFormModalRef>();
    renderWithProps(modalRef);

    const modal = screen.getByTestId(`modal-case-note-form`);
    expect(modal).not.toHaveClass('is-visible');
    const openButton = screen.getByTestId(openModalButtonId);
    expect(openButton).toBeInTheDocument();
    expect(modal).not.toHaveClass('is-visible');

    await userEvent.click(openButton);
    expect(modal).toHaveClass('is-visible');

    const titleInput = screen.getByTestId(titleInputId);
    await userEvent.type(titleInput, title);
    expect(titleInput).toHaveValue(title);
    const contentInput = screen.getByTestId(contentInputId);
    await userEvent.type(contentInput, content);
    expect(contentInput).toHaveValue(content);
    const cancelButton = screen.getByTestId(cancelButtonId);
    expect(cancelButton).toBeVisible();
    await userEvent.click(cancelButton);
    expect(modal).not.toHaveClass('is-visible');
  });

  test('Should display error and not close modal if error occurs submitting new case note', async () => {
    const editedNoteTitleText = 'Edited Note Title';
    const editedNoteContentText = 'Edited Note Content';
    const notesSubmissionErrorMessage = 'There was a problem submitting the case note.';
    const modalRef = React.createRef<CaseNoteFormModalRef>();
    const postSpy = vi.spyOn(Api2, 'postCaseNote').mockRejectedValue({});
    renderWithProps(modalRef);

    const modal = screen.getByTestId(modalId);
    expect(modal).not.toHaveClass('is-visible');
    const openButton = screen.getByTestId(openModalButtonId);
    expect(openButton).toBeInTheDocument();

    await userEvent.click(openButton);
    expect(modal).toHaveClass('is-visible');

    const titleInput = screen.getByTestId(titleInputId);
    const contentInput = screen.getByTestId(contentInputId);

    await userEvent.type(titleInput, editedNoteTitleText);
    await userEvent.type(contentInput, editedNoteContentText);
    await userEvent.click(screen.getByTestId(submitButtonId));
    expect(postSpy).toHaveBeenCalled();
    const errorMessage = screen.getByTestId('alert-message-case-note-form-error');
    expect(errorMessage).toBeVisible();
    expect(errorMessage).toHaveTextContent(notesSubmissionErrorMessage);
    expect(modal).toHaveClass('is-visible');
  });

  test('Should display error and not close modal if title or content are empty on new note submission', async () => {
    const editedNoteTitleText = 'Edited Note Title';
    const modalRef = React.createRef<CaseNoteFormModalRef>();
    const postSpy = vi.spyOn(Api2, 'postCaseNote').mockResolvedValue();
    renderWithProps(modalRef);

    const modal = screen.getByTestId(modalId);
    expect(modal).not.toHaveClass('is-visible');
    const openButton = screen.getByTestId(openModalButtonId);
    expect(openButton).toBeInTheDocument();

    await userEvent.click(openButton);
    expect(modal).toHaveClass('is-visible');

    const titleInput = screen.getByTestId(titleInputId);

    await waitFor(() => {
      expect(titleInput).toHaveValue('');
    });
    await userEvent.type(titleInput, editedNoteTitleText);
    await waitFor(() => {
      expect(titleInput).toHaveValue(editedNoteTitleText);
    });
    await userEvent.click(screen.getByTestId(submitButtonId));
    await waitFor(() => {
      const error = screen.queryByTestId('alert-message-case-note-form-error');
      expect(error).toBeVisible();
    });
    expect(screen.queryByTestId('alert-message-case-note-form-error')).toHaveTextContent(
      notesRequiredFieldsMessage,
    );
    expect(postSpy).not.toHaveBeenCalled();
    expect(modal).toHaveClass('is-visible');
  });

  test('Should display error and not close modal if error occurs submitting a case note edit', async () => {
    const editedNoteTitleText = 'Edited Note Title';
    const editedNoteContentText = 'Edited Note Content';

    const modalRef = React.createRef<CaseNoteFormModalRef>();
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

    const modal = screen.getByTestId(modalId);
    expect(modal).not.toHaveClass('is-visible');
    const openButton = screen.getByTestId(openModalButtonId);
    expect(openButton).toBeInTheDocument();

    await userEvent.click(openButton);
    expect(modal).toHaveClass('is-visible');

    const titleInput = screen.getByTestId(titleInputId);
    const contentInput = screen.getByTestId(contentInputId);

    await userEvent.type(titleInput, editedNoteTitleText);
    await userEvent.type(contentInput, editedNoteContentText);
    await userEvent.click(screen.getByTestId(submitButtonId));
    expect(postSpy).toHaveBeenCalled();
    const errorMessage = screen.getByTestId('alert-case-note-form-error');
    expect(errorMessage).toBeVisible();
    expect(errorMessage).toHaveTextContent(notesSubmissionErrorMessage);
    expect(modal).toHaveClass('is-visible');
  });

  test('Should display error and not close modal if error occurs submitting a case note edit when note content or title are empty', async () => {
    const editedNoteTitleText = 'Edited Note Title';
    const editedNoteContentText = 'Edited Note Content';

    const modalRef = React.createRef<CaseNoteFormModalRef>();
    const postSpy = vi.spyOn(Api2, 'putCaseNote').mockResolvedValue('');
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

    const modal = screen.getByTestId(modalId);
    expect(modal).not.toHaveClass('is-visible');
    const openButton = screen.getByTestId(openModalButtonId);
    expect(openButton).toBeInTheDocument();

    await userEvent.click(openButton);
    expect(modal).toHaveClass('is-visible');

    const titleInput = screen.getByTestId(titleInputId);
    const contentInput = screen.getByTestId(contentInputId);

    await userEvent.type(titleInput, editedNoteTitleText);
    await userEvent.clear(contentInput);
    await userEvent.click(screen.getByTestId(submitButtonId));
    expect(postSpy).not.toHaveBeenCalled();
    const errorMessage = screen.getByTestId('alert-case-note-form-error');
    expect(errorMessage).toBeVisible();
    expect(errorMessage).toHaveTextContent(notesRequiredFieldsMessage);
    expect(modal).toHaveClass('is-visible');
  });

  test('modal show method should set up form fields based on local form cache values when cache has existing values and then should clear fields after submitting modal', async () => {
    const clearFormSpy = vi.spyOn(LocalFormCache, 'clearForm');
    const putSpy = vi.spyOn(Api2, 'putCaseNote').mockResolvedValue('some-id');
    await setUpAndLoadFromCache('test title', 'test content');

    const submitButton = screen.getByTestId(submitButtonId);
    await userEvent.click(submitButton);

    expect(putSpy).toHaveBeenCalled();
    expect(clearFormSpy).toHaveBeenCalledTimes(2);
  });

  test('modal show method should set up form fields based on local form cache values when cache has existing values and then should clear fields after canceling modal', async () => {
    const putSpy = vi.spyOn(Api2, 'putCaseNote').mockResolvedValue('some-id');
    const clearFormSpy = vi.spyOn(LocalFormCache, 'clearForm');
    await setUpAndLoadFromCache('test title', 'test content');

    const cancelButton = screen.getByTestId(cancelButtonId);
    await userEvent.click(cancelButton);

    expect(putSpy).not.toHaveBeenCalled();
    expect(clearFormSpy).toHaveBeenCalledTimes(2);
  });

  test('modal show method should set up form fields based on local form cache values when length of formData.title is 0', async () => {
    // expects for this test are all in setUpAndLoadFromCache...
    await setUpAndLoadFromCache('', 'test content');

    const cancelButton = screen.getByTestId(cancelButtonId);
    await userEvent.click(cancelButton);
  });

  test('modal show method should set up form fields based on local form cache values when length of formData.content is 0', async () => {
    // expects for this test are all in setUpAndLoadFromCache...
    await setUpAndLoadFromCache('test title', '');

    const cancelButton = screen.getByTestId(cancelButtonId);
    await userEvent.click(cancelButton);
  });

  test('should default to empty string if no ref passed into getCaseNotesInputValue', () => {
    const returnValue = getCaseNotesInputValue(null);
    expect(returnValue).toEqual('');
  });
});
