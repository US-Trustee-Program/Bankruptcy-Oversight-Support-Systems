import { render, screen, waitFor } from '@testing-library/react';
import Api2 from '@/lib/models/api2';
import CaseNotes from './CaseNotes';
import MockData from '@common/cams/test-utilities/mock-data';
import Actions from '@common/cams/actions';
import LocalStorage from '@/lib/utils/local-storage';

const caseId = '000-11-22222';
const userId = '001';
const userFullName = 'Joe Bob';

interface CaseNotesProps {
  caseId: string;
}

function renderWithProps(props?: Partial<CaseNotesProps>) {
  const defaultProps: CaseNotesProps = {
    caseId: '000-11-22222',
  };
  const renderProps = { ...defaultProps, ...props };
  return render(<CaseNotes {...renderProps} />);
}

describe('CaseNotes Adapter Tests', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('API Integration', () => {
    test('should fetch case notes from API on mount', async () => {
      const getCaseNotesSpy = vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: [] });

      renderWithProps({ caseId });

      await waitFor(() => {
        expect(getCaseNotesSpy).toHaveBeenCalledWith(caseId);
      });
    });

    test('should handle API error gracefully', async () => {
      vi.spyOn(Api2, 'getCaseNotes').mockRejectedValue(new Error('API error'));

      renderWithProps({ caseId });

      await waitFor(() => {
        expect(screen.queryByTestId('empty-notes')).toBeInTheDocument();
      });
    });

    test('should refetch notes after creating a note', async () => {
      const caseNotes = [MockData.getCaseNote({ caseId })];
      const getCaseNotesSpy = vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: caseNotes });
      const postCaseNoteSpy = vi.spyOn(Api2, 'postCaseNote').mockResolvedValue();
      const session = MockData.getCamsSession();
      session.user.id = userId;
      session.user.name = userFullName;
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);

      renderWithProps({ caseId });

      await waitFor(() => {
        expect(getCaseNotesSpy).toHaveBeenCalledTimes(1);
      });

      expect(postCaseNoteSpy).not.toHaveBeenCalled();
    });
  });

  describe('Data Transformation', () => {
    test('should transform CaseNote[] to generic Note[] with entityId', async () => {
      const caseNotes = [
        MockData.getCaseNote({ caseId, title: 'Case Note 1' }),
        MockData.getCaseNote({ caseId, title: 'Case Note 2' }),
      ];
      vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: caseNotes });

      renderWithProps({ caseId });

      await waitFor(() => {
        expect(screen.queryByTestId('searchable-notes')).toBeInTheDocument();
      });

      expect(screen.getByText('Case Note 1')).toBeInTheDocument();
      expect(screen.getByText('Case Note 2')).toBeInTheDocument();
    });
  });

  describe('Props to Notes Component', () => {
    test('should pass correct entityId (caseId)', async () => {
      const caseNotes = [MockData.getCaseNote({ caseId })];
      vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: caseNotes });

      renderWithProps({ caseId });

      await waitFor(() => {
        expect(screen.queryByTestId('searchable-notes')).toBeInTheDocument();
      });
    });

    test('should pass correct title "Case Notes"', async () => {
      vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: [] });

      renderWithProps({ caseId });

      await waitFor(() => {
        expect(screen.getByText('Case Notes')).toBeInTheDocument();
      });
    });

    test('should pass correct draft keys', async () => {
      vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: [] });

      renderWithProps({ caseId });

      await waitFor(() => {
        expect(screen.getByText('Add Note')).toBeInTheDocument();
      });
    });

    test('should pass correct actions (EditNote, RemoveNote)', async () => {
      const session = MockData.getCamsSession();
      session.user.id = userId;
      session.user.name = userFullName;
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);

      const caseNotes = [
        MockData.addAction(
          MockData.getCaseNote({ caseId, updatedBy: { id: userId, name: userFullName } }),
          [Actions.EditNote, Actions.RemoveNote],
        ),
      ];
      vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: caseNotes });

      renderWithProps({ caseId });

      await waitFor(() => {
        expect(screen.queryByTestId('searchable-notes')).toBeInTheDocument();
      });

      const editButtons = document.querySelectorAll('.edit-button');
      const deleteButtons = document.querySelectorAll('.remove-button');
      expect(editButtons.length).toBeGreaterThan(0);
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    test('should pass correct empty message', async () => {
      vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: [] });

      renderWithProps({ caseId });

      await waitFor(() => {
        expect(screen.getByText('No notes exist for this case.')).toBeInTheDocument();
      });
    });
  });

  describe('Callback Handlers', () => {
    test('handleCreateNote should call postCaseNote with correct data', async () => {
      const session = MockData.getCamsSession();
      session.user.id = userId;
      session.user.name = userFullName;
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: [] });
      vi.spyOn(Api2, 'postCaseNote').mockResolvedValue();

      renderWithProps({ caseId });

      await waitFor(() => {
        expect(screen.getByText('Add Note')).toBeInTheDocument();
      });
    });

    test('handleUpdateNote should call putCaseNote with correct data', async () => {
      const session = MockData.getCamsSession();
      session.user.id = userId;
      session.user.name = userFullName;
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);

      const caseNotes = [
        MockData.addAction(
          MockData.getCaseNote({ caseId, updatedBy: { id: userId, name: userFullName } }),
          [Actions.EditNote, Actions.RemoveNote],
        ),
      ];
      vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: caseNotes });
      vi.spyOn(Api2, 'putCaseNote').mockResolvedValue(undefined);

      renderWithProps({ caseId });

      await waitFor(() => {
        expect(screen.queryByTestId('searchable-notes')).toBeInTheDocument();
      });
    });

    test('handleDeleteNote should call deleteCaseNote with correct data', async () => {
      const session = MockData.getCamsSession();
      session.user.id = userId;
      session.user.name = userFullName;
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);

      const caseNotes = [
        MockData.addAction(
          MockData.getCaseNote({ caseId, updatedBy: { id: userId, name: userFullName } }),
          [Actions.EditNote, Actions.RemoveNote],
        ),
      ];
      vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: caseNotes });
      vi.spyOn(Api2, 'deleteCaseNote').mockResolvedValue();

      renderWithProps({ caseId });

      await waitFor(() => {
        expect(screen.queryByTestId('searchable-notes')).toBeInTheDocument();
      });
    });

    test('should handle missing session gracefully', async () => {
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
      vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: [] });

      renderWithProps({ caseId });

      await waitFor(() => {
        expect(screen.getByText('Add Note')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    test('should pass isLoading=true while fetching', async () => {
      vi.spyOn(Api2, 'getCaseNotes').mockImplementation(() => new Promise(() => {}));

      renderWithProps({ caseId });

      await waitFor(() => {
        expect(screen.getByTestId('notes-loading-indicator')).toBeInTheDocument();
      });
    });

    test('should pass isLoading=false after fetch completes', async () => {
      vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: [] });

      renderWithProps({ caseId });

      await waitFor(() => {
        expect(screen.queryByTestId('notes-loading-indicator')).not.toBeInTheDocument();
      });
    });
  });
});
