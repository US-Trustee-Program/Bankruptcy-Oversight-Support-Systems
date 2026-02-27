import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Api2 from '@/lib/models/api2';
import TrusteeNotes from './TrusteeNotes';
import MockData from '@common/cams/test-utilities/mock-data';
import Actions from '@common/cams/actions';
import { randomUUID } from 'crypto';
import LocalStorage from '@/lib/utils/local-storage';

const trusteeId = randomUUID();
const userId = '001';
const userFullName = 'Joe Bob';

const trusteeNotes = [
  MockData.addAction(
    MockData.getTrusteeNote({ trusteeId, updatedBy: { id: userId, name: userFullName } }),
    [Actions.EditTrusteeNote, Actions.RemoveTrusteeNote],
  ),
  MockData.getTrusteeNote({ trusteeId }),
  MockData.addAction(
    MockData.getTrusteeNote({
      trusteeId,
      updatedBy: { id: userId, name: userFullName },
      previousVersionId: randomUUID(),
    }),
    [Actions.EditTrusteeNote, Actions.RemoveTrusteeNote],
  ),
];

describe('trustee notes tests', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should display loading indicator while loading', async () => {
    vi.spyOn(Api2, 'getTrusteeNotes').mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    render(<TrusteeNotes trusteeId={trusteeId} />);

    const loadingIndicator = await screen.findByTestId('trustee-notes-loading-indicator');
    expect(loadingIndicator).toBeInTheDocument();
  });

  test('should display no notes message when no notes exist', async () => {
    vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: [] });

    render(<TrusteeNotes trusteeId={trusteeId} />);

    await waitFor(() => {
      expect(screen.queryByTestId('empty-trustee-notes-test-id')).toBeInTheDocument();
    });
  });

  test('should render notes list when notes exist', async () => {
    vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: trusteeNotes });

    render(<TrusteeNotes trusteeId={trusteeId} />);

    await waitFor(() => {
      expect(screen.queryByTestId('searchable-trustee-notes')).toBeInTheDocument();
    });
  });

  test('should show edit and delete buttons only for own notes', async () => {
    const session = MockData.getCamsSession();
    session.user.id = userId;
    session.user.name = userFullName;
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: trusteeNotes });

    render(<TrusteeNotes trusteeId={trusteeId} />);

    await waitFor(() => {
      expect(screen.queryByTestId('searchable-trustee-notes')).toBeInTheDocument();
    });

    const editButtons = document.querySelectorAll('.edit-button');
    const deleteButtons = document.querySelectorAll('.remove-button');

    // The two notes with actions should have edit/delete buttons
    expect(editButtons).toHaveLength(2);
    expect(deleteButtons).toHaveLength(2);
  });

  test('should show "Add Note" button', async () => {
    vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: [] });

    render(<TrusteeNotes trusteeId={trusteeId} />);

    await waitFor(() => {
      expect(screen.getByText('Add Note')).toBeInTheDocument();
    });
  });

  test('should show empty state when API call fails', async () => {
    vi.spyOn(Api2, 'getTrusteeNotes').mockRejectedValue(new Error('API error'));

    render(<TrusteeNotes trusteeId={trusteeId} />);

    await waitFor(() => {
      expect(screen.queryByTestId('empty-trustee-notes-test-id')).toBeInTheDocument();
    });
  });

  test('should show "Edited by" label for notes with previousVersionId', async () => {
    vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: trusteeNotes });

    render(<TrusteeNotes trusteeId={trusteeId} />);

    await waitFor(() => {
      expect(screen.queryByTestId('searchable-trustee-notes')).toBeInTheDocument();
    });

    const editedLabels = screen.queryAllByText(/Edited by:/);
    expect(editedLabels.length).toBeGreaterThan(0);
  });

  describe('sorting', () => {
    const sortableNotes = [
      MockData.getTrusteeNote({ trusteeId, title: 'Banana', updatedOn: '2024-01-01T00:00:00Z' }),
      MockData.getTrusteeNote({ trusteeId, title: 'Apple', updatedOn: '2024-03-01T00:00:00Z' }),
      MockData.getTrusteeNote({ trusteeId, title: 'Cherry', updatedOn: '2024-02-01T00:00:00Z' }),
    ];

    function getNoteHeaders() {
      return screen.getAllByRole('listitem').map((li) => li.querySelector('h4')?.textContent ?? '');
    }

    test('should default to newest first', async () => {
      vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: sortableNotes });

      render(<TrusteeNotes trusteeId={trusteeId} />);

      await waitFor(() => {
        expect(screen.queryByTestId('searchable-trustee-notes')).toBeInTheDocument();
      });

      expect(getNoteHeaders()).toEqual(['Apple', 'Cherry', 'Banana']);
    });

    test('should sort oldest first when selected', async () => {
      vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: sortableNotes });

      render(<TrusteeNotes trusteeId={trusteeId} />);

      await waitFor(() => {
        expect(screen.queryByTestId('searchable-trustee-notes')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'oldest' } });

      expect(getNoteHeaders()).toEqual(['Banana', 'Cherry', 'Apple']);
    });

    test('should sort by title A-Z when selected', async () => {
      vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: sortableNotes });

      render(<TrusteeNotes trusteeId={trusteeId} />);

      await waitFor(() => {
        expect(screen.queryByTestId('searchable-trustee-notes')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'title' } });

      expect(getNoteHeaders()).toEqual(['Apple', 'Banana', 'Cherry']);
    });
  });
});
