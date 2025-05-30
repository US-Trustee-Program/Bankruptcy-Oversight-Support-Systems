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
    title: '',
    content: '',
    initialTitle: '',
    initialContent: '',
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
    initialTitle: '',
    initialContent: '',
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

async function setUpAndLoadFromCache(
  cachedTitle: string,
  cachedContent: string,
  opts: {
    modalProps?: Partial<CaseNoteFormModalProps>;
    openProps?: Partial<CaseNoteFormModalOpenProps>;
  } = {},
) {
  const note = MockData.getCaseNote();
  const modalRef = React.createRef<CaseNoteFormModalRef>();
  vi.spyOn(LocalFormCache, 'getForm').mockReturnValue({
    value: {
      caseId: opts.openProps?.caseId ?? note.caseId,
      title: cachedTitle,
      content: cachedContent,
    },
    expiresAfter: 1,
  });
  const saveFormSpy = vi.spyOn(LocalFormCache, 'saveForm');
  const clearFormSpy = vi.spyOn(LocalFormCache, 'clearForm');
  const noteId = randomUUID();

  const expectedTitle = opts.openProps?.title ?? cachedTitle;
  const expectedContent = opts.openProps?.content ?? cachedContent;

  const noteOpenProps: Partial<CaseNoteFormModalOpenProps> = {
    ...opts.openProps,
    id: opts.openProps?.id ?? noteId,
    caseId: opts.openProps?.caseId ?? note.caseId,
    title: expectedTitle,
    content: expectedContent,
    initialTitle: opts.openProps?.initialTitle ?? '',
    initialContent: opts.openProps?.initialContent ?? '',
  };

  renderWithProps(modalRef, { ...opts.modalProps }, noteOpenProps);

  const modal = screen.getByTestId(`modal-case-note-form`);
  const openButton = screen.getByTestId(openModalButtonId);
  await userEvent.click(openButton);
  expect(modal).toHaveClass('is-visible');

  const input = document.querySelector('input');
  const textarea = document.querySelector('textarea');
  const submitBtn = screen.getByTestId(submitButtonId);

  expect(input).toHaveValue(expectedTitle);
  expect(textarea).toHaveValue(expectedContent);

  const newTitle = 'new title';
  const newContent = 'new content';

  await userEvent.clear(input!);
  await userEvent.clear(textarea!);
  expect(clearFormSpy).toHaveBeenCalledTimes(1);

  await userEvent.type(input!, newTitle);
  await userEvent.type(textarea!, newContent);

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

  test('modal show method should set up form fields based on open props', async () => {
    const clearFormSpy = vi.spyOn(LocalFormCache, 'clearForm');
    const putSpy = vi.spyOn(Api2, 'putCaseNote').mockResolvedValue('some-id');
    await setUpAndLoadFromCache('test title', 'test content');

    const submitButton = screen.getByTestId(submitButtonId);
    await userEvent.click(submitButton);

    expect(putSpy).toHaveBeenCalled();
    expect(clearFormSpy).toHaveBeenCalledTimes(2);
  });

  test('should default to empty string if no ref passed into getCaseNotesInputValue', () => {
    const returnValue = getCaseNotesInputValue(null);
    expect(returnValue).toEqual('');
  });

  test('Should call onModalClosed callback when modal closes after successful submission', async () => {
    const onModalClosedSpy = vi.fn();

    const postNoteSpy = vi.spyOn(Api2, 'postCaseNote');
    postNoteSpy.mockResolvedValue();

    const modalRef = React.createRef<CaseNoteFormModalRef>();
    renderWithProps(modalRef, { onModalClosed: onModalClosedSpy });

    const modal = screen.getByTestId(`modal-case-note-form`);
    const openButton = screen.getByTestId(openModalButtonId);
    await userEvent.click(openButton);
    expect(modal).toHaveClass('is-visible');

    const titleInput = screen.getByTestId(titleInputId);
    const contentInput = screen.getByTestId(contentInputId);
    await userEvent.type(titleInput, 'New Note Title');
    await userEvent.type(contentInput, 'New Note Content');
    await userEvent.click(screen.getByTestId(submitButtonId));

    await waitFor(() => {
      expect(modal).not.toHaveClass('is-visible');
    });
  });

  test('Should call onModalClosed callback when modal closes after cancellation', async () => {
    const onModalClosedSpy = vi.fn();

    await setUpAndLoadFromCache('test title', 'test content', {
      modalProps: { onModalClosed: onModalClosedSpy },
    });

    const modal = screen.getByTestId(`modal-case-note-form`);
    const openButton = screen.getByTestId(openModalButtonId);
    await userEvent.click(openButton);
    expect(modal).toHaveClass('is-visible');

    const titleInput = screen.getByTestId(titleInputId);
    const contentInput = screen.getByTestId(contentInputId);
    await userEvent.type(titleInput, 'Draft Title');
    await userEvent.type(contentInput, 'Draft Content');

    const cancelButton = screen.getByTestId(cancelButtonId);
    await userEvent.click(cancelButton);
    expect(modal).not.toHaveClass('is-visible');

    expect(onModalClosedSpy).toHaveBeenCalledTimes(1);
    expect(onModalClosedSpy).toHaveBeenCalledWith(expect.stringMatching(/^\d{3}-\d{2}-\d{5}$/gm));
  });

  test('Should clear form cache and call onModalClosed callback when modal is cancelled', async () => {
    const onModalClosedSpy = vi.fn();

    const clearFormSpy = vi.spyOn(LocalFormCache, 'clearForm');
    await setUpAndLoadFromCache('test title', 'test content', {
      modalProps: { onModalClosed: onModalClosedSpy },
    });

    const cancelButton = screen.getByTestId(cancelButtonId);
    await userEvent.click(cancelButton);

    // Verify the form cache was cleared
    expect(clearFormSpy).toHaveBeenCalled();

    // Verify the callback was called
    expect(onModalClosedSpy).toHaveBeenCalledTimes(1);
    expect(onModalClosedSpy).toHaveBeenCalledWith(expect.stringMatching(/^\d{3}-\d{2}-\d{5}$/gm));
  });

  test('Should disable Save button unless both Title and Content have non-empty values', async () => {
    const modalRef = React.createRef<CaseNoteFormModalRef>();
    renderWithProps(modalRef);

    const modal = screen.getByTestId(modalId);
    const openButton = screen.getByTestId(openModalButtonId);
    await userEvent.click(openButton);
    expect(modal).toHaveClass('is-visible');

    const titleInput = screen.getByTestId(titleInputId);
    const contentInput = screen.getByTestId(contentInputId);
    const submitButton = screen.getByTestId(submitButtonId);

    expect(titleInput).toHaveValue('');
    expect(contentInput).toHaveValue('');
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });

    await userEvent.type(titleInput, 'Test Title');
    expect(titleInput).toHaveValue('Test Title');
    expect(contentInput).toHaveValue('');
    expect(submitButton).toBeDisabled();

    await userEvent.clear(titleInput);
    await userEvent.type(contentInput, 'Test Content');
    expect(titleInput).toHaveValue('');
    expect(contentInput).toHaveValue('Test Content');
    expect(submitButton).toBeDisabled();

    await userEvent.type(titleInput, 'Test Title');
    expect(titleInput).toHaveValue('Test Title');
    expect(contentInput).toHaveValue('Test Content');
    expect(submitButton).toBeEnabled();

    await userEvent.clear(titleInput);
    expect(titleInput).toHaveValue('');
    expect(contentInput).toHaveValue('Test Content');
    expect(submitButton).toBeDisabled();
  });
});
