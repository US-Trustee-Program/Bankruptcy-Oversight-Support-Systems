import { render, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import CaseNotes from './CaseNotes';
import Api2 from '@/lib/models/api2';
import Notes from '@/lib/components/cams/Notes/Notes';
import * as UseGlobalAlertModule from '@/lib/hooks/UseGlobalAlert';
import MockData from '@common/cams/test-utilities/mock-data';
import Actions from '@common/cams/actions';
import LocalStorage from '@/lib/utils/local-storage';
import { getCamsUserReference } from '@common/cams/session';
import { NoteInput } from '@/lib/components/cams/Notes/types';
import { CaseNote } from '@common/cams/cases';

vi.mock('@/lib/components/cams/Notes/Notes', () => ({
  default: vi.fn(() => null),
}));

const caseId = '000-11-22222';

const mockGlobalAlert = {
  show: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  success: vi.fn(),
};

describe('CaseNotes Adapter', () => {
  const MockNotes = vi.mocked(Notes);

  function getNotesProps() {
    return MockNotes.mock.lastCall?.[0] as React.ComponentProps<typeof Notes>;
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    MockNotes.mockClear();
    vi.spyOn(UseGlobalAlertModule, 'useGlobalAlert').mockReturnValue(mockGlobalAlert);
    vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: [] });
  });

  describe('Notes props configuration', () => {
    test('passes caseId as entityId', async () => {
      render(<CaseNotes caseId={caseId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());
      expect(getNotesProps().entityId).toBe(caseId);
    });

    test('passes title "Case Notes"', async () => {
      render(<CaseNotes caseId={caseId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());
      expect(getNotesProps().title).toBe('Case Notes');
    });

    test('passes correct createDraftKey', async () => {
      render(<CaseNotes caseId={caseId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());
      expect(getNotesProps().createDraftKey).toBe(`case-notes-${caseId}`);
    });

    test('passes correct editDraftKeyPrefix', async () => {
      render(<CaseNotes caseId={caseId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());
      expect(getNotesProps().editDraftKeyPrefix).toBe(`case-notes-${caseId}`);
    });

    test('passes EditNote as editAction', async () => {
      render(<CaseNotes caseId={caseId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());
      expect(getNotesProps().editAction).toBe(Actions.EditNote);
    });

    test('passes RemoveNote as removeAction', async () => {
      render(<CaseNotes caseId={caseId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());
      expect(getNotesProps().removeAction).toBe(Actions.RemoveNote);
    });

    test('passes correct emptyMessage', async () => {
      render(<CaseNotes caseId={caseId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());
      expect(getNotesProps().emptyMessage).toBe('No notes exist for this case.');
    });
  });

  describe('Data fetching', () => {
    test('fetches case notes on mount', async () => {
      const getCaseNotesSpy = vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: [] });
      render(<CaseNotes caseId={caseId} />);
      await waitFor(() => expect(getCaseNotesSpy).toHaveBeenCalledWith(caseId));
    });

    test('maps caseId to entityId on each note', async () => {
      const mockCaseNote = MockData.getCaseNote({ caseId });
      vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: [mockCaseNote] });

      render(<CaseNotes caseId={caseId} />);

      await waitFor(() => {
        const notes = getNotesProps()?.notes;
        expect(notes).toHaveLength(1);
        expect(notes[0]).toEqual({
          ...mockCaseNote,
          entityId: caseId,
        });
      });
    });

    test('sets isLoading=true while fetching and false after fetch completes', async () => {
      let resolve: (value: { data: CaseNote[] }) => void;
      const promise = new Promise<{ data: CaseNote[] }>((res) => {
        resolve = res;
      });
      vi.spyOn(Api2, 'getCaseNotes').mockReturnValue(promise);

      render(<CaseNotes caseId={caseId} />);

      await waitFor(() => expect(getNotesProps()?.isLoading).toBe(true));

      resolve!({ data: [] });

      await waitFor(() => expect(getNotesProps()?.isLoading).toBe(false));
    });

    test('passes empty notes and clears loading on fetch error', async () => {
      let reject: (reason: Error) => void;
      const promise = new Promise<{ data: CaseNote[] }>((_, rej) => {
        reject = rej;
      });
      vi.spyOn(Api2, 'getCaseNotes').mockReturnValue(promise);

      render(<CaseNotes caseId={caseId} />);

      await waitFor(() => expect(getNotesProps()?.isLoading).toBe(true));

      reject!(new Error('API error'));

      await waitFor(() => {
        expect(getNotesProps()?.isLoading).toBe(false);
        expect(getNotesProps()?.notes).toEqual([]);
      });
    });
  });

  describe('onCreateNote handler', () => {
    const noteData: NoteInput = { entityId: caseId, title: 'New Note', content: 'Content' };

    test('calls postCaseNote with correct args', async () => {
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      const postSpy = vi.spyOn(Api2, 'postCaseNote').mockResolvedValue();

      render(<CaseNotes caseId={caseId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());

      await getNotesProps().onCreateNote(noteData);

      expect(postSpy).toHaveBeenCalledWith({
        caseId,
        title: noteData.title,
        content: noteData.content,
        updatedBy: getCamsUserReference(session.user),
      });
    });

    test('re-fetches notes after creating', async () => {
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      vi.spyOn(Api2, 'postCaseNote').mockResolvedValue();
      const getCaseNotesSpy = vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: [] });

      render(<CaseNotes caseId={caseId} />);
      await waitFor(() => expect(getCaseNotesSpy).toHaveBeenCalledTimes(1));

      await getNotesProps().onCreateNote(noteData);

      expect(getCaseNotesSpy).toHaveBeenCalledTimes(2);
    });

    test('does not call API when session is missing', async () => {
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
      const postSpy = vi.spyOn(Api2, 'postCaseNote').mockResolvedValue();

      render(<CaseNotes caseId={caseId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());

      await getNotesProps().onCreateNote(noteData);

      expect(postSpy).not.toHaveBeenCalled();
    });

    test('throws when postCaseNote fails', async () => {
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      vi.spyOn(Api2, 'postCaseNote').mockRejectedValue(new Error('API error'));

      render(<CaseNotes caseId={caseId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());

      await expect(getNotesProps().onCreateNote(noteData)).rejects.toThrow('API error');
    });
  });

  describe('onUpdateNote handler', () => {
    const noteId = 'note-abc';
    const noteData: NoteInput = {
      entityId: caseId,
      title: 'Updated Note',
      content: 'Updated content',
    };

    test('calls putCaseNote with correct args', async () => {
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      const putSpy = vi.spyOn(Api2, 'putCaseNote').mockResolvedValue(undefined);

      render(<CaseNotes caseId={caseId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());

      await getNotesProps().onUpdateNote(noteId, noteData);

      expect(putSpy).toHaveBeenCalledWith({
        id: noteId,
        caseId,
        title: noteData.title,
        content: noteData.content,
        updatedBy: getCamsUserReference(session.user),
      });
    });

    test('re-fetches notes after updating', async () => {
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      vi.spyOn(Api2, 'putCaseNote').mockResolvedValue(undefined);
      const getCaseNotesSpy = vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: [] });

      render(<CaseNotes caseId={caseId} />);
      await waitFor(() => expect(getCaseNotesSpy).toHaveBeenCalledTimes(1));

      await getNotesProps().onUpdateNote(noteId, noteData);

      expect(getCaseNotesSpy).toHaveBeenCalledTimes(2);
    });

    test('does not call API when session is missing', async () => {
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
      const putSpy = vi.spyOn(Api2, 'putCaseNote').mockResolvedValue(undefined);

      render(<CaseNotes caseId={caseId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());

      await getNotesProps().onUpdateNote(noteId, noteData);

      expect(putSpy).not.toHaveBeenCalled();
    });

    test('throws when putCaseNote fails', async () => {
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      vi.spyOn(Api2, 'putCaseNote').mockRejectedValue(new Error('API error'));

      render(<CaseNotes caseId={caseId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());

      await expect(getNotesProps().onUpdateNote(noteId, noteData)).rejects.toThrow('API error');
    });
  });

  describe('onDeleteNote handler', () => {
    const noteId = 'note-to-delete';

    test('calls deleteCaseNote with correct args', async () => {
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      const deleteSpy = vi.spyOn(Api2, 'deleteCaseNote').mockResolvedValue();

      render(<CaseNotes caseId={caseId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());

      await getNotesProps().onDeleteNote(noteId);

      expect(deleteSpy).toHaveBeenCalledWith({
        id: noteId,
        caseId,
        updatedBy: getCamsUserReference(session.user),
      });
    });

    test('re-fetches notes after deleting', async () => {
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      vi.spyOn(Api2, 'deleteCaseNote').mockResolvedValue();
      const getCaseNotesSpy = vi.spyOn(Api2, 'getCaseNotes').mockResolvedValue({ data: [] });

      render(<CaseNotes caseId={caseId} />);
      await waitFor(() => expect(getCaseNotesSpy).toHaveBeenCalledTimes(1));

      await getNotesProps().onDeleteNote(noteId);

      expect(getCaseNotesSpy).toHaveBeenCalledTimes(2);
    });

    test('does not call API when session is missing', async () => {
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
      const deleteSpy = vi.spyOn(Api2, 'deleteCaseNote').mockResolvedValue();

      render(<CaseNotes caseId={caseId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());

      await getNotesProps().onDeleteNote(noteId);

      expect(deleteSpy).not.toHaveBeenCalled();
    });

    test('throws when deleteCaseNote fails', async () => {
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      vi.spyOn(Api2, 'deleteCaseNote').mockRejectedValue(new Error('Delete failed'));

      render(<CaseNotes caseId={caseId} />);
      await waitFor(() => expect(MockNotes).toHaveBeenCalled());

      await expect(getNotesProps().onDeleteNote(noteId)).rejects.toThrow('Delete failed');
    });
  });
});
