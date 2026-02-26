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

    const editButtons = screen.queryAllByText('Edit');
    const deleteButtons = screen.queryAllByText('Delete');

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

  test('should show "Edited on" label for notes with previousVersionId', async () => {
    vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: trusteeNotes });

    render(<TrusteeNotes trusteeId={trusteeId} />);

    await waitFor(() => {
      expect(screen.queryByTestId('searchable-trustee-notes')).toBeInTheDocument();
    });

    const editedLabels = screen.queryAllByText(/Edited on:/);
    expect(editedLabels.length).toBeGreaterThan(0);
  });
});
