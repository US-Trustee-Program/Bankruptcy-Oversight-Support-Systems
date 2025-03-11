import { render, screen, waitFor } from '@testing-library/react';
import Api2 from '@/lib/models/api2';
import CaseNotes, { CaseNotesProps } from './CaseNotes';
import userEvent from '@testing-library/user-event';
import testingUtilities from '@/lib/testing/testing-utilities';
import HttpStatusCodes from '@common/api/http-status-codes';

const textAreaTestId = 'textarea-note-content';
const noteTitleInputTestId = 'case-note-title-input';

function renderWithProps(props?: Partial<CaseNotesProps>) {
  const defaultProps: CaseNotesProps = {
    caseId: '000-11-22222',
    hasCaseNotes: false,
    caseNotes: [],
    searchString: '',
    onNoteCreation: vi.fn(),
    onNoteArchive: vi.fn(),
    areCaseNotesLoading: false,
  };

  const renderProps = { ...defaultProps, ...props };
  render(<CaseNotes {...renderProps} />);
}

vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: [] });
vi.spyOn(Api2, 'postCaseNote').mockImplementation((): Promise<void> => Promise.resolve());

describe('case note globalAlert specific tests that conflict with other case note tests', () => {
  test('should call globalAlert.error when attempting to create a note with no text in content', async () => {
    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();

    renderWithProps();

    const noteTitleInput = screen.getByTestId(noteTitleInputTestId);
    expect(noteTitleInput).toBeInTheDocument();
    await userEvent.type(noteTitleInput, 'test note');

    const textArea = screen.getByTestId(textAreaTestId);
    expect(textArea).toBeInTheDocument();

    const button = screen.getByTestId('button-submit-case-note');
    expect(button).toBeInTheDocument();
    await userEvent.click(button);

    await waitFor(() => {
      expect(globalAlertSpy.error).toHaveBeenCalledWith(
        'All case note input fields are required to submit a note.',
      );
    });
  });

  test('should call globalAlert.error when postCaseNote receives a common error', async () => {
    vi.spyOn(Api2, 'postCaseNote').mockRejectedValue({
      status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
    });

    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();

    renderWithProps();

    const noteTitleInput = screen.getByTestId(noteTitleInputTestId);
    expect(noteTitleInput).toBeInTheDocument();
    await userEvent.type(noteTitleInput, 'test note title');

    const textArea = screen.getByTestId(textAreaTestId);
    expect(textArea).toBeInTheDocument();
    await userEvent.type(textArea, 'test note');

    const button = screen.getByTestId('button-submit-case-note');
    expect(button).toBeInTheDocument();
    await userEvent.click(button);

    await waitFor(() => {
      expect(globalAlertSpy.error).toHaveBeenCalledWith('Could not insert case note.');
    });
  });

  test('should call globalAlert.error when postCaseNote receives a forbidden request error', async () => {
    vi.spyOn(Api2, 'postCaseNote').mockRejectedValue({
      status: HttpStatusCodes.FORBIDDEN,
    });

    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();

    renderWithProps();

    const noteTitleInput = screen.getByTestId(noteTitleInputTestId);
    expect(noteTitleInput).toBeInTheDocument();
    await userEvent.type(noteTitleInput, 'test note title');

    const textArea = screen.getByTestId(textAreaTestId);
    expect(textArea).toBeInTheDocument();
    await userEvent.type(textArea, 'test note');

    const button = screen.getByTestId('button-submit-case-note');
    expect(button).toBeInTheDocument();
    await userEvent.click(button);

    await waitFor(() => {
      expect(globalAlertSpy.error).not.toHaveBeenCalled();
    });
  });
});
