import { render, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import TrusteeNotes from './TrusteeNotes';
import Api2 from '@/lib/models/api2';
import Notes from '@/lib/components/cams/Notes/Notes';
import * as UseGlobalAlertModule from '@/lib/hooks/UseGlobalAlert';
import MockData from '@common/cams/test-utilities/mock-data';
import Actions from '@common/cams/actions';
import LocalStorage from '@/lib/utils/local-storage';
import { getCamsUserReference } from '@common/cams/session';
import { NoteInput } from '@/lib/components/cams/Notes/types';
import { TrusteeNote } from '@common/cams/trustee-notes';

vi.mock('@/lib/components/cams/Notes/Notes', () => ({
  default: vi.fn(() => null),
}));

const trusteeId = 'trustee-123';

const mockGlobalAlert = {
  show: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  success: vi.fn(),
};

describe('TrusteeNotes Adapter', () => {
  const MockNotes = vi.mocked(Notes);

  function getNotesProps() {
    return MockNotes.mock.lastCall?.[0] as React.ComponentProps<typeof Notes>;
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    MockNotes.mockClear();
    vi.spyOn(UseGlobalAlertModule, 'useGlobalAlert').mockReturnValue(mockGlobalAlert);
    vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: [] });
  });

  describe('Notes props configuration', () => {
    test('passes trusteeId as entityId', async () => {
      render(<TrusteeNotes trusteeId={trusteeId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());
      expect(getNotesProps().entityId).toBe(trusteeId);
    });

    test('passes title "Trustee Notes"', async () => {
      render(<TrusteeNotes trusteeId={trusteeId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());
      expect(getNotesProps().title).toBe('Trustee Notes');
    });

    test('passes correct createDraftKey', async () => {
      render(<TrusteeNotes trusteeId={trusteeId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());
      expect(getNotesProps().createDraftKey).toBe(`trustee-notes-${trusteeId}`);
    });

    test('passes correct editDraftKeyPrefix', async () => {
      render(<TrusteeNotes trusteeId={trusteeId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());
      expect(getNotesProps().editDraftKeyPrefix).toBe(`trustee-notes-${trusteeId}`);
    });

    test('passes EditTrusteeNote as editAction', async () => {
      render(<TrusteeNotes trusteeId={trusteeId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());
      expect(getNotesProps().editAction).toBe(Actions.EditTrusteeNote);
    });

    test('passes RemoveTrusteeNote as removeAction', async () => {
      render(<TrusteeNotes trusteeId={trusteeId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());
      expect(getNotesProps().removeAction).toBe(Actions.RemoveTrusteeNote);
    });

    test('passes correct emptyMessage', async () => {
      render(<TrusteeNotes trusteeId={trusteeId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());
      expect(getNotesProps().emptyMessage).toBe('No notes exist for this trustee.');
    });
  });

  describe('Data fetching', () => {
    test('fetches trustee notes on mount', async () => {
      const getTrusteeNotesSpy = vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: [] });
      render(<TrusteeNotes trusteeId={trusteeId} />);
      await waitFor(() => expect(getTrusteeNotesSpy).toHaveBeenCalledWith(trusteeId));
    });

    test('maps trusteeId to entityId on each note', async () => {
      const MockeTrusteeNote = MockData.getTrusteeNote({ trusteeId });
      const trusteeNotes = [MockeTrusteeNote];
      vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: trusteeNotes });

      render(<TrusteeNotes trusteeId={trusteeId} />);

      await waitFor(() => {
        const notes = getNotesProps()?.notes;
        expect(notes).toHaveLength(1);
        expect(notes[0]).toEqual({
          ...MockeTrusteeNote,
          entityId: trusteeId,
        });
      });
    });

    test('sets isLoading=true while fetching and false after fetch completes', async () => {
      let resolve: (value: { data: TrusteeNote[] }) => void;
      const promise = new Promise<{ data: TrusteeNote[] }>((res) => {
        resolve = res;
      });
      vi.spyOn(Api2, 'getTrusteeNotes').mockReturnValue(promise);

      render(<TrusteeNotes trusteeId={trusteeId} />);

      await waitFor(() => expect(getNotesProps()?.isLoading).toBe(true));

      resolve!({ data: [] });

      await waitFor(() => expect(getNotesProps()?.isLoading).toBe(false));
    });

    test('passes empty notes and clears loading on fetch error', async () => {
      let reject: (reason: Error) => void;
      const promise = new Promise<{ data: TrusteeNote[] }>((_, rej) => {
        reject = rej;
      });
      vi.spyOn(Api2, 'getTrusteeNotes').mockReturnValue(promise);

      render(<TrusteeNotes trusteeId={trusteeId} />);

      await waitFor(() => expect(getNotesProps()?.isLoading).toBe(true));

      reject!(new Error('API error'));

      await waitFor(() => {
        expect(getNotesProps()?.isLoading).toBe(false);
        expect(getNotesProps()?.notes).toEqual([]);
      });
    });
  });

  describe('onCreateNote handler', () => {
    const noteData: NoteInput = { entityId: trusteeId, title: 'New Note', content: 'Content' };

    test('calls postTrusteeNote with correct args', async () => {
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      const postSpy = vi.spyOn(Api2, 'postTrusteeNote').mockResolvedValue();

      render(<TrusteeNotes trusteeId={trusteeId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());

      await getNotesProps().onCreateNote(noteData);

      expect(postSpy).toHaveBeenCalledWith({
        trusteeId,
        title: noteData.title,
        content: noteData.content,
        updatedBy: getCamsUserReference(session.user),
      });
    });

    test('re-fetches notes after creating', async () => {
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      vi.spyOn(Api2, 'postTrusteeNote').mockResolvedValue();
      const getTrusteeNotesSpy = vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: [] });

      render(<TrusteeNotes trusteeId={trusteeId} />);
      await waitFor(() => expect(getTrusteeNotesSpy).toHaveBeenCalledTimes(1));

      expect(getTrusteeNotesSpy).toHaveBeenCalledTimes(1);

      await getNotesProps().onCreateNote(noteData);

      expect(getTrusteeNotesSpy).toHaveBeenCalledTimes(2);
    });

    test('does not call API when session is missing', async () => {
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
      const postSpy = vi.spyOn(Api2, 'postTrusteeNote').mockResolvedValue();

      render(<TrusteeNotes trusteeId={trusteeId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());

      await getNotesProps().onCreateNote(noteData);

      expect(postSpy).not.toHaveBeenCalled();
    });

    test('throws when postTrusteeNote fails', async () => {
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      vi.spyOn(Api2, 'postTrusteeNote').mockRejectedValue(new Error('API error'));

      render(<TrusteeNotes trusteeId={trusteeId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());

      await expect(getNotesProps().onCreateNote(noteData)).rejects.toThrow('API error');
    });
  });

  describe('onUpdateNote handler', () => {
    const noteId = 'note-abc';
    const noteData: NoteInput = {
      entityId: trusteeId,
      title: 'Updated Note',
      content: 'Updated content',
    };

    test('calls putTrusteeNote with correct args', async () => {
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      const putSpy = vi.spyOn(Api2, 'putTrusteeNote').mockResolvedValue(undefined);

      render(<TrusteeNotes trusteeId={trusteeId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());

      await getNotesProps().onUpdateNote(noteId, noteData);

      expect(putSpy).toHaveBeenCalledWith({
        id: noteId,
        trusteeId,
        title: noteData.title,
        content: noteData.content,
        updatedBy: getCamsUserReference(session.user),
      });
    });

    test('re-fetches notes after updating', async () => {
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      vi.spyOn(Api2, 'putTrusteeNote').mockResolvedValue(undefined);
      const getTrusteeNotesSpy = vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: [] });

      render(<TrusteeNotes trusteeId={trusteeId} />);
      await waitFor(() => expect(getTrusteeNotesSpy).toHaveBeenCalledTimes(1));

      expect(getTrusteeNotesSpy).toHaveBeenCalledTimes(1);

      await getNotesProps().onUpdateNote(noteId, noteData);

      expect(getTrusteeNotesSpy).toHaveBeenCalledTimes(2);
    });

    test('does not call API when session is missing', async () => {
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
      const putSpy = vi.spyOn(Api2, 'putTrusteeNote').mockResolvedValue(undefined);

      render(<TrusteeNotes trusteeId={trusteeId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());

      await getNotesProps().onUpdateNote(noteId, noteData);

      expect(putSpy).not.toHaveBeenCalled();
    });

    test('throws when putTrusteeNote fails', async () => {
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      vi.spyOn(Api2, 'putTrusteeNote').mockRejectedValue(new Error('API error'));

      render(<TrusteeNotes trusteeId={trusteeId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());

      await expect(getNotesProps().onUpdateNote(noteId, noteData)).rejects.toThrow('API error');
    });
  });

  describe('onDeleteNote handler', () => {
    const noteId = 'note-to-delete';

    test('calls deleteTrusteeNote with correct args', async () => {
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      const deleteSpy = vi.spyOn(Api2, 'deleteTrusteeNote').mockResolvedValue();

      render(<TrusteeNotes trusteeId={trusteeId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());

      await getNotesProps().onDeleteNote(noteId);

      expect(deleteSpy).toHaveBeenCalledWith({
        id: noteId,
        trusteeId,
        updatedBy: getCamsUserReference(session.user),
      });
    });

    test('re-fetches notes after deleting', async () => {
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      vi.spyOn(Api2, 'deleteTrusteeNote').mockResolvedValue();
      const getTrusteeNotesSpy = vi.spyOn(Api2, 'getTrusteeNotes').mockResolvedValue({ data: [] });

      render(<TrusteeNotes trusteeId={trusteeId} />);
      await waitFor(() => expect(getTrusteeNotesSpy).toHaveBeenCalledTimes(1));

      expect(getTrusteeNotesSpy).toHaveBeenCalledTimes(1);

      await getNotesProps().onDeleteNote(noteId);

      expect(getTrusteeNotesSpy).toHaveBeenCalledTimes(2);
    });

    test('does not call API when session is missing', async () => {
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
      const deleteSpy = vi.spyOn(Api2, 'deleteTrusteeNote').mockResolvedValue();

      render(<TrusteeNotes trusteeId={trusteeId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());

      await getNotesProps().onDeleteNote(noteId);

      expect(deleteSpy).not.toHaveBeenCalled();
    });

    test('throws when deleteTrusteeNote fails', async () => {
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      vi.spyOn(Api2, 'deleteTrusteeNote').mockRejectedValue(new Error('Delete failed'));

      render(<TrusteeNotes trusteeId={trusteeId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());

      await expect(getNotesProps().onDeleteNote(noteId)).rejects.toThrow('Delete failed');
    });
  });
});
