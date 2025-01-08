import { render, screen, waitFor } from '@testing-library/react';
import Api2 from '@/lib/models/api2';
import CaseNotes from './CaseNotes';
import MockData from '@common/cams/test-utilities/mock-data';
import { formatDate } from '@/lib/utils/datetime';
import userEvent from '@testing-library/user-event';
import testingUtilities from '@/lib/testing/testing-utilities';

describe('audit history tests', () => {
  const caseId = '000-11-22222';
  const textAreaTestId = 'textarea-note-creation';
  const caseNotes = [
    MockData.getCaseNote({ caseId }),
    MockData.getCaseNote({ caseId }),
    MockData.getCaseNote({ caseId }),
  ];

  test('should display loading indicator if loading', async () => {
    vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({
      data: [],
    });

    render(<CaseNotes caseId={caseId} />);

    const loadingIndicator = screen.queryByTestId('notes-loading-indicator');
    expect(loadingIndicator).toBeInTheDocument();
  });

  test('should display no case notes message if no case notes exists', async () => {
    vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({
      data: [],
    });

    render(<CaseNotes caseId={caseId} />);

    const emptyCaseNotes = await screen.findByTestId('empty-notes-test-id');
    expect(emptyCaseNotes).toHaveTextContent('No notes exist for this case.');

    const caseNotesTable = screen.queryByTestId('case-notes-table');
    expect(caseNotesTable).not.toBeInTheDocument();
  });

  test('should display table of case notes when notes exist', async () => {
    vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({
      data: caseNotes,
    });

    render(<CaseNotes caseId={caseId} />);

    const emptyCaseNotes = screen.queryByTestId('empty-notes-test-id');
    expect(emptyCaseNotes).not.toBeInTheDocument();

    await waitFor(() => {
      const caseNotesTable = screen.getByTestId('case-notes-table');
      expect(caseNotesTable).toBeInTheDocument();
    });

    for (let i = 0; i < caseNotes.length; i++) {
      const noteContents = screen.getByTestId(`note-preview-${i}`);
      expect(noteContents).toBeInTheDocument();
      expect(noteContents).toHaveTextContent(caseNotes[i].content);

      const modifiedByContents = screen.getByTestId(`changed-by-${i}`);
      expect(modifiedByContents).toBeInTheDocument();
      expect(modifiedByContents).toHaveTextContent(caseNotes[i].updatedBy.name);

      const dateContents = screen.getByTestId(`created-date-${i}`);
      expect(dateContents).toBeInTheDocument();
      expect(dateContents).toHaveTextContent(formatDate(caseNotes[i].updatedOn));
    }
  });

  test('should call globalAlert.error when getCaseNotes receives an error', async () => {
    vi.spyOn(Api2, 'getCaseNotes').mockRejectedValue({ status: 404 });

    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();

    render(<CaseNotes caseId={caseId} />);

    await waitFor(() => {
      expect(globalAlertSpy.error).toHaveBeenCalledWith('Could not retrieve case notes.');
    });
  });

  test('should send new case note to api and call fetch notes on success', async () => {
    const getCaseNotesSpy = vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({
      data: caseNotes,
    });
    const postCaseNoteSpy = vi
      .spyOn(Api2, 'postCaseNote')
      .mockImplementation(async (): Promise<void> => {
        return Promise.resolve();
      });

    render(<CaseNotes caseId={caseId} />);

    const testNote = 'test note';
    let textArea = screen.getByTestId(textAreaTestId);
    expect(textArea).toBeInTheDocument();
    await userEvent.type(textArea, testNote);
    expect(textArea).toHaveValue(testNote);

    const button = screen.getByTestId('button-button-submit-case-note');
    expect(button).toBeInTheDocument();
    await userEvent.click(button);

    expect(getCaseNotesSpy).toHaveBeenNthCalledWith(2, caseId);
    expect(postCaseNoteSpy).toHaveBeenCalledWith(caseId, testNote);

    textArea = screen.getByTestId(textAreaTestId);
    expect(textArea).toHaveValue('');
  });

  test('should call globalAlert.error when postCaseNote receives an error', async () => {
    vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: [] });
    vi.spyOn(Api2, 'postCaseNote').mockImplementation((): Promise<void> => Promise.reject());

    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();

    render(<CaseNotes caseId={caseId} />);

    const textArea = screen.getByTestId(textAreaTestId);
    expect(textArea).toBeInTheDocument();
    await userEvent.type(textArea, 'test note');

    const button = screen.getByTestId('button-button-submit-case-note');
    expect(button).toBeInTheDocument();
    await userEvent.click(button);

    await waitFor(() => {
      expect(globalAlertSpy.error).toHaveBeenCalledWith('Could not insert case note.');
    });
  });

  test('should call globalAlert.error when attempting to create a note with no content', async () => {
    vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: [] });
    vi.spyOn(Api2, 'postCaseNote').mockImplementation((): Promise<void> => Promise.reject());

    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();

    render(<CaseNotes caseId={caseId} />);

    const textArea = screen.getByTestId(textAreaTestId);
    expect(textArea).toBeInTheDocument();

    const button = screen.getByTestId('button-button-submit-case-note');
    expect(button).toBeInTheDocument();
    await userEvent.click(button);

    await waitFor(() => {
      expect(globalAlertSpy.error).toHaveBeenCalledWith('Cannot submit an empty case note.');
    });
  });
});
