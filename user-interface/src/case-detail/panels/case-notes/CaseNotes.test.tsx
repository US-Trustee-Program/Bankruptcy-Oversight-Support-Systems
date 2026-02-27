import { act, render, screen, waitFor } from '@testing-library/react';
import Api2 from '@/lib/models/api2';
import CaseNotes, { CaseNotesProps, CaseNotesRef, getCaseNotesInputValue } from './CaseNotes';
import MockData from '@common/cams/test-utilities/mock-data';
import { formatDateTime } from '@/lib/utils/datetime';
import { InputRef } from '@/lib/type-declarations/input-fields';
import React from 'react';
import Input from '@/lib/components/uswds/Input';
import LocalStorage from '@/lib/utils/local-storage';
import LocalFormCache from '@/lib/utils/local-form-cache';
import Actions from '@common/cams/actions';
import { randomUUID } from 'crypto';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

const caseId = '000-11-22222';
const userId = '001';
const userFullName = 'Joe Bob';
const caseNotes = [
  MockData.addAction(
    MockData.getCaseNote({ caseId, updatedBy: { id: userId, name: userFullName } }),
    [Actions.EditNote, Actions.RemoveNote],
  ),
  MockData.getCaseNote({ caseId }),
  MockData.addAction(
    MockData.getCaseNote({
      caseId,
      updatedBy: { id: userId, name: userFullName },
      previousVersionId: randomUUID(),
    }),
    [Actions.EditNote, Actions.RemoveNote],
  ),
];
const caseNotesRef = React.createRef<CaseNotesRef>();

function renderWithProps(props?: Partial<CaseNotesProps>) {
  const defaultProps: CaseNotesProps = {
    caseId: '000-11-22222',
    hasCaseNotes: false,
    caseNotes: [],
    searchString: '',
    onUpdateNoteRequest: vi.fn(),
    areCaseNotesLoading: false,
  };
  const renderProps = { ...defaultProps, ...props };
  return render(<CaseNotes {...renderProps} ref={caseNotesRef} />);
}

describe('case note tests', () => {
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    vi.resetModules();
    userEvent = TestingUtilities.setupUserEvent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should display loading indicator if loading', async () => {
    vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({
      data: [],
    });

    renderWithProps({ areCaseNotesLoading: true });

    const loadingIndicator = screen.queryByTestId('notes-loading-indicator');
    expect(loadingIndicator).toBeInTheDocument();
  });

  test('should call focusEditButton on ref', async () => {
    vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({
      data: caseNotes,
    });
    const session = MockData.getCamsSession();
    session.user.id = userId;
    session.user.name = userFullName;
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);

    renderWithProps({ caseId, hasCaseNotes: true, caseNotes });

    await waitFor(() => {
      expect(caseNotesRef.current).not.toBeNull();
    });

    // NOTE: This spy MUST be defined AFTER the rendering is complete.
    // So we wait for current to not be null above, and only then define the spy
    const caseNotesFocusSpy = vi.spyOn(caseNotesRef.current!, 'focusEditButton');
    const testNote = caseNotes[0];
    const testNoteId = testNote.id;
    act(() => caseNotesRef.current!.focusEditButton(testNoteId!));
    expect(caseNotesFocusSpy).toHaveBeenCalledWith(testNoteId);

    await waitFor(() => {
      const testButton = screen.getByTestId('open-modal-button_case-note-edit-button_0');
      expect(testButton).toHaveFocus();
    });
  });

  test('should display no case notes message if no case notes exists', async () => {
    vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({
      data: [],
    });

    renderWithProps();

    const emptyCaseNotes = await screen.findByTestId('empty-notes-test-id');
    expect(emptyCaseNotes).toHaveTextContent('No notes exist for this case.');

    const caseNotesTable = screen.queryByTestId('searchable-case-notes');
    expect(caseNotesTable).not.toBeInTheDocument();
    const button0 = screen.queryByTestId('open-modal-button_case-note-edit-button_0');
    expect(button0).not.toBeInTheDocument();
  });

  test('should display table of case notes when notes exist', async () => {
    vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({
      data: caseNotes,
    });

    renderWithProps({ caseId, hasCaseNotes: true, caseNotes });

    const emptyCaseNotes = screen.queryByTestId('empty-notes-test-id');
    expect(emptyCaseNotes).not.toBeInTheDocument();

    await waitFor(() => {
      const caseNotesTable = screen.getByTestId('searchable-case-notes');
      expect(caseNotesTable).toBeInTheDocument();
    });

    for (let i = 0; i < caseNotes.length; i++) {
      const noteTitle = screen.getByTestId(`case-note-${i}-header`);
      expect(noteTitle).toBeInTheDocument();
      expect(noteTitle).toHaveTextContent(caseNotes[i].title);

      const noteContents = screen.getByTestId(`case-note-${i}-text`);
      expect(noteContents).toBeInTheDocument();
      expect(noteContents).toHaveTextContent(caseNotes[i].content);

      const metadataContents = screen.getByTestId(`case-note-creation-date-${i}`);
      expect(metadataContents).toBeInTheDocument();
      expect(metadataContents).toHaveTextContent(caseNotes[i].updatedBy.name);
      const expectedDateText = caseNotes[i].previousVersionId
        ? `Edited by: ${caseNotes[i].updatedBy.name} on ${formatDateTime(caseNotes[i].updatedOn)}`
        : `Created by: ${caseNotes[i].updatedBy.name} on ${formatDateTime(caseNotes[i].updatedOn)}`;

      expect(metadataContents).toHaveTextContent(expectedDateText);
    }
  });

  test('should remove case note when remove button is clicked and modal approval is met.', async () => {
    const session = MockData.getCamsSession();
    session.user.id = userId;
    session.user.name = userFullName;
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({
      data: caseNotes,
    });
    const deleteSpy = vi
      .spyOn(Api2, 'deleteCaseNote')
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error());
    const expectedUser = {
      id: userId,
      name: userFullName,
    };
    const expectedFirstRemoveArgument = {
      id: caseNotes[0].id,
      caseId: caseNotes[0].caseId,
      updatedBy: expectedUser,
    };
    const expectedSecondRemoveArgument = {
      id: caseNotes[2].id,
      caseId: caseNotes[2].caseId,
      updatedBy: expectedUser,
    };
    const onNoteRemoveSpy = vi.fn();

    renderWithProps({
      caseId,
      hasCaseNotes: true,
      caseNotes,
      onUpdateNoteRequest: onNoteRemoveSpy,
    });

    const button0 = screen.queryByTestId('open-modal-button_case-note-remove-button_0');
    const button1 = screen.queryByTestId('open-modal-button_case-note-remove-button_1');
    const button2 = screen.queryByTestId('open-modal-button_case-note-remove-button_2');

    await waitFor(() => {
      expect(button0).toBeInTheDocument();
    });
    expect(button1).not.toBeInTheDocument();
    expect(button2).toBeInTheDocument();

    await userEvent.click(button0!);
    const modalSubmitButton0 = screen.queryByTestId('button-remove-note-modal-submit-button');
    await waitFor(() => {
      expect(modalSubmitButton0).toBeVisible();
    });
    await userEvent.click(modalSubmitButton0!);
    expect(deleteSpy).toHaveBeenCalledWith(expectedFirstRemoveArgument);
    expect(onNoteRemoveSpy).toHaveBeenCalled();

    await userEvent.click(button2!);
    const modalSubmitButton2 = screen.queryByTestId('button-remove-note-modal-submit-button');
    await waitFor(() => {
      expect(modalSubmitButton2).toBeVisible();
    });
    await userEvent.click(modalSubmitButton2!);
    expect(deleteSpy).toHaveBeenCalledWith(expectedSecondRemoveArgument);
    expect(onNoteRemoveSpy).toHaveBeenCalledTimes(1);
  });

  test('getCaseNotesInputValue should always return an empty string when a null is provided', async () => {
    const ref = React.createRef<InputRef>();
    render(<Input ref={ref}></Input>);

    const result1 = getCaseNotesInputValue(ref.current);
    expect(result1).toEqual('');
    expect(typeof result1).toEqual('string');

    const result2 = getCaseNotesInputValue(null);
    expect(result2).toEqual('');
    expect(typeof result2).toEqual('string');
  });

  test('should display info alert if cache holds a case note for the case', async () => {
    const mockCachedNote = {
      value: {
        caseId,
        title: 'Draft Note Title',
        content: 'Draft Note Content',
      },
      expiresAfter: 1,
    };
    vi.spyOn(LocalFormCache, 'getForm').mockImplementation((key: string) => {
      if (key === `case-notes-${caseId}`) {
        return mockCachedNote;
      }
      return null;
    });

    renderWithProps({ caseId });

    const draftNoteAlert = await screen.findByTestId('draft-note-alert-test-id');
    expect(draftNoteAlert).toBeInTheDocument();
    expect(draftNoteAlert).toHaveTextContent(/you have a draft case note/i);
  });

  test('should display edit note draft alert if cache holds an edit draft', async () => {
    const noteId = caseNotes[0].id!;
    const editFormKey = `case-notes-${caseId}-${noteId}`;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 1);

    const mockCachedEditNote = {
      value: {
        caseId,
        title: 'Draft Edit Title',
        content: 'Draft Edit Content',
      },
      expiresAfter: expiryDate.valueOf(),
    };

    vi.spyOn(LocalFormCache, 'getForm').mockImplementation((key: string) => {
      if (key === editFormKey) {
        return mockCachedEditNote;
      }
      return null;
    });

    renderWithProps({ caseId, hasCaseNotes: true, caseNotes });

    await waitFor(() => {
      const caseNote = screen.getByTestId('case-note-0');
      expect(caseNote).toBeInTheDocument();
    });

    const editDraftAlert = screen.getByTestId(`alert-message-draft-edit-case-note-${noteId}`);
    expect(editDraftAlert).toBeInTheDocument();
    expect(editDraftAlert).toHaveTextContent(
      `You have a draft case note. It will expire on ${formatDateTime(expiryDate)}.`,
    );
  });

  test('should remove draft alert when modal is closed', async () => {
    const mockCachedNote = {
      value: {
        caseId,
        title: 'Draft Note Title',
        content: 'Draft Note Content',
      },
      expiresAfter: 1,
    };

    let shouldReturnCachedNote = true;
    vi.spyOn(LocalFormCache, 'getForm').mockImplementation((key: string) => {
      if (key === `case-notes-${caseId}` && shouldReturnCachedNote) {
        return mockCachedNote;
      }
      return null;
    });

    renderWithProps({ caseId });

    const initialDraftNoteAlert = await screen.findByTestId('draft-note-alert-test-id');
    expect(initialDraftNoteAlert).toBeInTheDocument();

    shouldReturnCachedNote = false;

    const addButton = screen.getByTestId('open-modal-button_case-note-add-button');
    await userEvent.click(addButton);

    await waitFor(() => {
      const modal = screen.getByTestId('modal-content-case-note-modal');
      expect(modal).toBeInTheDocument();
    });

    const cancelButton = screen.getByText(/discard/i);
    await userEvent.click(cancelButton);

    await waitFor(() => {
      const draftNoteAlert = screen.queryByTestId('draft-note-alert-test-id');
      expect(draftNoteAlert).not.toBeInTheDocument();
    });
  });

  test('should remove edit note draft alert when edit modal is closed', async () => {
    const noteId = caseNotes[0].id!;
    const editFormKey = `case-notes-${caseId}-${noteId}`;

    const mockCachedEditNote = {
      value: {
        caseId,
        title: 'Draft Edit Title',
        content: 'Draft Edit Content',
      },
      expiresAfter: 1,
    };

    let shouldReturnCachedEditNote = true;

    vi.spyOn(LocalFormCache, 'getForm').mockImplementation((key: string) => {
      if (key === `case-notes-${caseId}-${noteId}` && shouldReturnCachedEditNote) {
        return mockCachedEditNote;
      }
      return null;
    });
    vi.spyOn(LocalFormCache, 'getFormsByPattern').mockImplementation((_pattern: RegExp) => {
      if (shouldReturnCachedEditNote) {
        return [{ key: editFormKey, item: mockCachedEditNote }];
      }
      return [];
    });

    renderWithProps({ caseId, hasCaseNotes: true, caseNotes });

    await waitFor(() => {
      const caseNote = screen.getByTestId('case-note-0');
      expect(caseNote).toBeInTheDocument();
    });

    const editDraftAlert = screen.getByTestId(`alert-message-draft-edit-case-note-${noteId}`);
    expect(editDraftAlert).toBeInTheDocument();

    shouldReturnCachedEditNote = false;

    const editButton = screen.getByTestId('open-modal-button_case-note-edit-button_0');
    await userEvent.click(editButton);
    const modal = screen.getByTestId('modal-case-note-modal');

    await waitFor(() => {
      expect(modal).toHaveClass('is-visible');
    });

    const cancelButton = screen.getByTestId('button-case-note-modal-cancel-button');
    await userEvent.click(cancelButton);
    await waitFor(() => {
      expect(modal).toHaveClass('is-hidden');
    });

    await waitFor(() => {
      const editDraftAlert = screen.queryByTestId(`alert-message-draft-edit-case-note-${noteId}`);
      expect(editDraftAlert).not.toBeInTheDocument();
    });
  });
});
