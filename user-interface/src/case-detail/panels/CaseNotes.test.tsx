import { render, screen, waitFor } from '@testing-library/react';
import Api2 from '@/lib/models/api2';
import CaseNotes, { CaseNotesProps } from './CaseNotes';
import MockData from '@common/cams/test-utilities/mock-data';
import { formatDateTime } from '@/lib/utils/datetime';
import userEvent from '@testing-library/user-event';
import { CaseNoteInput } from '@common/cams/cases';

const caseId = '000-11-22222';
const textAreaTestId = 'textarea-note-content';
const noteTitleInputTestId = 'case-note-title-input';
const caseNotes = [
  MockData.getCaseNote({ caseId }),
  MockData.getCaseNote({ caseId }),
  MockData.getCaseNote({ caseId }),
];

function renderWithProps(props?: Partial<CaseNotesProps>) {
  const defaultProps: CaseNotesProps = {
    caseId: '000-11-22222',
    hasCaseNotes: false,
    caseNotes: [],
    searchString: '',
    onNoteCreation: vi.fn(),
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
    vi.clearAllMocks();
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

  test('should show Note Draft Alert when content or title have not been pushed to cosmos, and dissapear on submission', async () => {
    vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: [] });
    vi.spyOn(Api2, 'postCaseNote').mockImplementation((): Promise<void> => Promise.resolve());
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    renderWithProps();

    const noteTitleInput = screen.getByTestId(noteTitleInputTestId);
    expect(noteTitleInput).toBeInTheDocument();
    await userEvent.type(noteTitleInput, 'test note title');

    const textArea = screen.getByTestId(textAreaTestId);
    expect(textArea).toBeInTheDocument();
    await userEvent.type(textArea, 'test note');
    //NOTE: Attempting to cover 168-170, might want to refactor to make it reachable by test
    await waitFor(() => {
      expect(setTimeoutSpy).toHaveBeenCalled();
    });

    await userEvent.clear(textArea);
    await userEvent.clear(noteTitleInput);

    await waitFor(() => {
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
    const button = screen.getByTestId('button-submit-case-note');
    expect(button).toBeInTheDocument();
    await userEvent.click(button);
  });

  test('should send new case note to api and call fetch notes on success', async () => {
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
    };

    expect(postCaseNoteSpy).toHaveBeenCalledWith(expectedCaseNoteInput);
    expect(spyOnNotesCreation).toHaveBeenCalled();

    textArea = screen.getByTestId(textAreaTestId);
    expect(textArea).toHaveValue('');
  });
});
