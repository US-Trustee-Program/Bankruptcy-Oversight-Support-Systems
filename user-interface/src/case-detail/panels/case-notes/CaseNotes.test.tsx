import { render, screen, waitFor } from '@testing-library/react';
import Api2 from '@/lib/models/api2';
import CaseNotes, { CaseNotesProps, CaseNotesRef, getCaseNotesInputValue } from './CaseNotes';
import MockData from '@common/cams/test-utilities/mock-data';
import { formatDateTime } from '@/lib/utils/datetime';
import userEvent from '@testing-library/user-event';
import { InputRef } from '@/lib/type-declarations/input-fields';
import React from 'react';
import Input from '@/lib/components/uswds/Input';
import LocalStorage from '@/lib/utils/local-storage';

const caseId = '000-11-22222';
const userId = '001';
const userFullName = 'Joe Bob';
const caseNotes = [
  MockData.getCaseNote({ caseId, updatedBy: { id: userId, name: userFullName } }),
  MockData.getCaseNote({ caseId }),
  MockData.getCaseNote({ caseId, updatedBy: { id: userId, name: userFullName } }),
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
  render(<CaseNotes {...renderProps} ref={caseNotesRef} />);
}

describe('case note tests', () => {
  beforeEach(() => {
    vi.resetModules();
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
    caseNotesRef.current!.focusEditButton(testNoteId!);
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
