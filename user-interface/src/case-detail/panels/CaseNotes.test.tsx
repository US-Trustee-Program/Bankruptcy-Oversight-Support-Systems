import { render, screen, waitFor } from '@testing-library/react';
import Api2 from '@/lib/models/api2';
import CaseNotes from './CaseNotes';
import MockData from '@common/cams/test-utilities/mock-data';
import { formatDate } from '@/lib/utils/datetime';

describe('audit history tests', () => {
  const caseId = '000-11-22222';
  const caseNotes = [MockData.getCaseNote({ caseId }), MockData.getCaseNote({ caseId })];
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
    console.log('Case Notes:    ', caseNotes);
    const firstNoteContents = screen.getByTestId('note-preview-0');
    expect(firstNoteContents).toBeInTheDocument();
    expect(firstNoteContents).toHaveTextContent(caseNotes[0].content);
    const firstModifiedByContents = screen.getByTestId('changed-by-0');
    expect(firstModifiedByContents).toBeInTheDocument();
    expect(firstModifiedByContents).toHaveTextContent(caseNotes[0].updatedBy.name);
    const firstDateContents = screen.getByTestId('created-date-0');
    expect(firstDateContents).toBeInTheDocument();
    expect(firstDateContents).toHaveTextContent(formatDate(caseNotes[0].updatedOn));
  });
});
