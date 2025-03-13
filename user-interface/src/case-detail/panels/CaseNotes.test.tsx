import { render, screen, waitFor } from '@testing-library/react';
import Api2 from '@/lib/models/api2';
import CaseNotes, { CaseNotesProps, getCaseNotesInputValue } from './CaseNotes';
import MockData from '@common/cams/test-utilities/mock-data';
import LocalFormCache from '../../lib/utils/local-form-cache';
import { formatDateTime } from '@/lib/utils/datetime';
import userEvent from '@testing-library/user-event';
import { CaseNoteInput } from '@common/cams/cases';
import { InputRef } from '@/lib/type-declarations/input-fields';
import React from 'react';
import Input from '@/lib/components/uswds/Input';
import LocalStorage from '@/lib/utils/local-storage';
import testingUtilities from '@/lib/testing/testing-utilities';

const caseId = '000-11-22222';
const textAreaTestId = 'textarea-note-content';
const noteTitleInputTestId = 'case-note-title-input';
const userId = '001';
const userFullName = 'Joe Bob';
const caseNotes = [
  MockData.getCaseNote({ caseId, updatedBy: { id: userId, name: userFullName } }),
  MockData.getCaseNote({ caseId }),
  MockData.getCaseNote({ caseId, updatedBy: { id: userId, name: userFullName } }),
];

function renderWithProps(props?: Partial<CaseNotesProps>) {
  const defaultProps: CaseNotesProps = {
    caseId: '000-11-22222',
    hasCaseNotes: false,
    caseNotes: [],
    searchString: '',
    onNoteCreation: vi.fn(),
    onRemoveNote: vi.fn(),
    areCaseNotesLoading: false,
  };

  const renderProps = { ...defaultProps, ...props };
  render(<CaseNotes {...renderProps} />);
}

describe('case note tests', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('useEffect on component initialization properly sets up form fields based on local form cache values when cache has existing values', async () => {
    const caseId = '01-12345';
    vi.spyOn(LocalFormCache, 'getForm').mockReturnValue({
      caseId,
      title: '',
      content: 'test content',
    });

    renderWithProps({ caseId });

    const input = document.querySelector('input');
    const textarea = document.querySelector('textarea');
    const submitBtn = document.querySelector('#submit-case-note');
    const clearBtn = document.querySelector('#clear-case-note');

    expect(input).toHaveValue('');
    expect(textarea).toHaveValue('test content');
    expect(submitBtn).toBeEnabled();
    expect(clearBtn).toBeEnabled();
  });

  test('useEffect on component initialization properly sets up form fields based on local form cache values when cache does not have existing values', async () => {
    const caseId = '01-12345';
    vi.spyOn(LocalFormCache, 'getForm').mockReturnValue({
      caseId,
      title: '',
      content: '',
    });

    renderWithProps({ caseId });

    const input = document.querySelector('input');
    const textarea = document.querySelector('textarea');
    const submitBtn = document.querySelector('#submit-case-note');
    const clearBtn = document.querySelector('#clear-case-note');

    expect(input).toHaveValue('');
    expect(textarea).toHaveValue('');
    expect(submitBtn).toBeDisabled();
    expect(clearBtn).toBeDisabled();
  });

  test('should display loading indicator if loading', async () => {
    vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({
      data: [],
    });

    renderWithProps({ areCaseNotesLoading: true });

    const loadingIndicator = screen.queryByTestId('notes-loading-indicator');
    expect(loadingIndicator).toBeInTheDocument();
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

      const modifiedByContents = screen.getByTestId(`case-note-author-${i}`);
      expect(modifiedByContents).toBeInTheDocument();
      expect(modifiedByContents).toHaveTextContent(caseNotes[i].updatedBy.name);

      const dateContents = screen.getByTestId(`case-note-creation-date-${i}`);
      expect(dateContents).toBeInTheDocument();
      expect(dateContents).toHaveTextContent(formatDateTime(caseNotes[i].updatedOn));
    }
  });

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

  test('should send new case note to api and call fetch notes on success', async () => {
    const session = MockData.getCamsSession();
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    const spyOnNotesCreation = vi.fn();
    const postCaseNoteSpy = vi
      .spyOn(Api2, 'postCaseNote')
      .mockImplementation(async (): Promise<void> => {
        return Promise.resolve();
      });

    renderWithProps({ onNoteCreation: spyOnNotesCreation });

    const testNoteContent = 'test note content';
    const testNoteTitle = 'test note title';
    let textArea = screen.getByTestId(textAreaTestId);
    const noteTitleInput = screen.getByTestId(noteTitleInputTestId);
    expect(textArea).toBeInTheDocument();
    expect(noteTitleInput).toBeInTheDocument();

    // start with a clean slate
    await userEvent.clear(noteTitleInput);
    await userEvent.clear(textArea);

    await userEvent.type(noteTitleInput, testNoteTitle);
    expect(noteTitleInput).toHaveValue(testNoteTitle);

    await userEvent.type(textArea, testNoteContent);
    expect(textArea).toHaveValue(testNoteContent);

    const button = screen.getByTestId('button-submit-case-note');
    expect(button).toBeInTheDocument();
    await userEvent.click(button);
    const expectedCaseNoteInput: CaseNoteInput = {
      title: testNoteTitle,
      content: testNoteContent,
      caseId: caseId,
      updatedBy: {
        id: session.user.id,
        name: session.user.name,
      },
    };

    expect(postCaseNoteSpy).toHaveBeenCalledWith(expectedCaseNoteInput);
    expect(spyOnNotesCreation).toHaveBeenCalled();

    textArea = screen.getByTestId(textAreaTestId);
    expect(textArea).toHaveValue('');
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
    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();
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

    renderWithProps({ caseId, hasCaseNotes: true, caseNotes, onRemoveNote: onNoteRemoveSpy });

    const button0 = screen.queryByTestId('open-modal-button-0');
    const button1 = screen.queryByTestId('open-modal-button-1');
    const button2 = screen.queryByTestId('open-modal-button-2');

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
    await waitFor(() => {
      expect(globalAlertSpy.error).toHaveBeenCalledWith('There was a problem archiving the note.');
    });
    expect(onNoteRemoveSpy).toHaveBeenCalledTimes(1);
  });
});

describe('test utilities', () => {
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
});
