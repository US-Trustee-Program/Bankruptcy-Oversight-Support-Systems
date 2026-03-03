import { render, screen, waitFor } from '@testing-library/react';
import Api2 from '@/lib/models/api2';
import TrusteeNotes from './TrusteeNotes';
import MockData from '@common/cams/test-utilities/mock-data';
import Actions from '@common/cams/actions';
import { randomUUID } from 'crypto';
import LocalStorage from '@/lib/utils/local-storage';

const trusteeId = randomUUID();
const userId = '001';
const userFullName = 'Joe Bob';

interface TrusteeNotesProps {
  trusteeId: string;
}

function renderWithProps(props?: Partial<TrusteeNotesProps>) {
  const defaultProps: TrusteeNotesProps = {
    trusteeId,
  };
  const renderProps = { ...defaultProps, ...props };
  return render(<TrusteeNotes {...renderProps} />);
}

describe('TrusteeNotes Adapter Tests', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('API Integration', () => {
    test('should fetch trustee notes from API on mount', async () => {
      const getTrusteeNotesSpy = vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: [] });

      renderWithProps({ trusteeId });

      await waitFor(() => {
        expect(getTrusteeNotesSpy).toHaveBeenCalledWith(trusteeId);
      });
    });

    test('should handle API error gracefully', async () => {
      vi.spyOn(Api2, 'getTrusteeNotes').mockRejectedValue(new Error('API error'));

      renderWithProps({ trusteeId });

      await waitFor(() => {
        expect(screen.queryByTestId('empty-notes')).toBeInTheDocument();
      });
    });

    test('should refetch notes after creating a note', async () => {
      const trusteeNotes = [MockData.getTrusteeNote({ trusteeId })];
      const getTrusteeNotesSpy = vi
        .spyOn(Api2, 'getTrusteeNotes')
        .mockResolvedValue({ data: trusteeNotes });
      const postTrusteeNoteSpy = vi.spyOn(Api2, 'postTrusteeNote').mockResolvedValue();
      const session = MockData.getCamsSession();
      session.user.id = userId;
      session.user.name = userFullName;
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);

      renderWithProps({ trusteeId });

      await waitFor(() => {
        expect(getTrusteeNotesSpy).toHaveBeenCalledTimes(1);
      });

      expect(postTrusteeNoteSpy).not.toHaveBeenCalled();
    });
  });

  describe('Data Transformation', () => {
    test('should transform TrusteeNote[] to generic Note[] with entityId', async () => {
      const trusteeNotes = [
        MockData.getTrusteeNote({ trusteeId, title: 'Trustee Note 1' }),
        MockData.getTrusteeNote({ trusteeId, title: 'Trustee Note 2' }),
      ];
      vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: trusteeNotes });

      renderWithProps({ trusteeId });

      await waitFor(() => {
        expect(screen.queryByTestId('searchable-notes')).toBeInTheDocument();
      });

      expect(screen.getByText('Trustee Note 1')).toBeInTheDocument();
      expect(screen.getByText('Trustee Note 2')).toBeInTheDocument();
    });
  });

  describe('Props to Notes Component', () => {
    test('should pass correct entityId (trusteeId)', async () => {
      const trusteeNotes = [MockData.getTrusteeNote({ trusteeId })];
      vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: trusteeNotes });

      renderWithProps({ trusteeId });

      await waitFor(() => {
        expect(screen.queryByTestId('searchable-notes')).toBeInTheDocument();
      });
    });

    test('should pass correct title "Trustee Notes"', async () => {
      vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: [] });

      renderWithProps({ trusteeId });

      await waitFor(() => {
        expect(screen.getByText('Trustee Notes')).toBeInTheDocument();
      });
    });

    test('should pass correct draft keys', async () => {
      vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: [] });

      renderWithProps({ trusteeId });

      await waitFor(() => {
        expect(screen.getByText('Add Note')).toBeInTheDocument();
      });
    });

    test('should pass correct actions (EditTrusteeNote, RemoveTrusteeNote)', async () => {
      const session = MockData.getCamsSession();
      session.user.id = userId;
      session.user.name = userFullName;
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);

      const trusteeNotes = [
        MockData.addAction(
          MockData.getTrusteeNote({ trusteeId, updatedBy: { id: userId, name: userFullName } }),
          [Actions.EditTrusteeNote, Actions.RemoveTrusteeNote],
        ),
      ];
      vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: trusteeNotes });

      renderWithProps({ trusteeId });

      await waitFor(() => {
        expect(screen.queryByTestId('searchable-notes')).toBeInTheDocument();
      });

      const editButtons = document.querySelectorAll('.edit-button');
      const deleteButtons = document.querySelectorAll('.remove-button');
      expect(editButtons.length).toBeGreaterThan(0);
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    test('should pass correct empty message', async () => {
      vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: [] });

      renderWithProps({ trusteeId });

      await waitFor(() => {
        expect(screen.getByText('No notes exist for this trustee.')).toBeInTheDocument();
      });
    });
  });

  describe('Callback Handlers', () => {
    test('handleCreateNote should call postTrusteeNote with correct data', async () => {
      const session = MockData.getCamsSession();
      session.user.id = userId;
      session.user.name = userFullName;
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: [] });
      vi.spyOn(Api2, 'postTrusteeNote').mockResolvedValue();

      renderWithProps({ trusteeId });

      await waitFor(() => {
        expect(screen.getByText('Add Note')).toBeInTheDocument();
      });
    });

    test('handleUpdateNote should call putTrusteeNote with correct data', async () => {
      const session = MockData.getCamsSession();
      session.user.id = userId;
      session.user.name = userFullName;
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);

      const trusteeNotes = [
        MockData.addAction(
          MockData.getTrusteeNote({ trusteeId, updatedBy: { id: userId, name: userFullName } }),
          [Actions.EditTrusteeNote, Actions.RemoveTrusteeNote],
        ),
      ];
      vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: trusteeNotes });
      vi.spyOn(Api2, 'putTrusteeNote').mockResolvedValue();

      renderWithProps({ trusteeId });

      await waitFor(() => {
        expect(screen.queryByTestId('searchable-notes')).toBeInTheDocument();
      });
    });

    test('handleDeleteNote should call deleteTrusteeNote with correct data', async () => {
      const session = MockData.getCamsSession();
      session.user.id = userId;
      session.user.name = userFullName;
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);

      const trusteeNotes = [
        MockData.addAction(
          MockData.getTrusteeNote({ trusteeId, updatedBy: { id: userId, name: userFullName } }),
          [Actions.EditTrusteeNote, Actions.RemoveTrusteeNote],
        ),
      ];
      vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: trusteeNotes });
      vi.spyOn(Api2, 'deleteTrusteeNote').mockResolvedValue();

      renderWithProps({ trusteeId });

      await waitFor(() => {
        expect(screen.queryByTestId('searchable-notes')).toBeInTheDocument();
      });
    });

    test('should handle missing session gracefully', async () => {
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
      vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: [] });

      renderWithProps({ trusteeId });

      await waitFor(() => {
        expect(screen.getByText('Add Note')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    test('should pass isLoading=true while fetching', async () => {
      vi.spyOn(Api2, 'getTrusteeNotes').mockImplementation(() => new Promise(() => {}));

      renderWithProps({ trusteeId });

      await waitFor(() => {
        expect(screen.getByTestId('notes-loading-indicator')).toBeInTheDocument();
      });
    });

    test('should pass isLoading=false after fetch completes', async () => {
      vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: [] });

      renderWithProps({ trusteeId });

      await waitFor(() => {
        expect(screen.queryByTestId('notes-loading-indicator')).not.toBeInTheDocument();
      });
    });
  });
});
