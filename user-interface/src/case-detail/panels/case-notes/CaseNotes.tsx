import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { CaseNote } from '@common/cams/cases';
import { NoteInput } from '@/lib/components/cams/Notes/types';
import { getCamsUserReference } from '@common/cams/session';
import LocalStorage from '@/lib/utils/local-storage';
import Actions from '@common/cams/actions';
import Notes from '@/lib/components/cams/Notes/Notes';

interface CaseNotesProps {
  caseId: string;
}

export default function CaseNotes({ caseId }: CaseNotesProps) {
  const [caseNotes, setCaseNotes] = useState<CaseNote[]>([]);
  const [areNotesLoading, setAreNotesLoading] = useState<boolean>(false);
  const globalAlert = useGlobalAlert();

  async function fetchCaseNotes() {
    setAreNotesLoading(true);
    try {
      const response = await Api2.getCaseNotes(caseId);
      setCaseNotes(response.data ?? []);
    } catch (_error) {
      globalAlert?.error('Could not load case notes');
      setCaseNotes([]);
    } finally {
      setAreNotesLoading(false);
    }
  }

  async function handleCreateNote(noteData: NoteInput) {
    const session = LocalStorage.getSession();
    if (!session?.user) {
      globalAlert?.error('User session not found');
      return;
    }

    try {
      await Api2.postCaseNote({
        caseId,
        title: noteData.title,
        content: noteData.content,
        updatedBy: getCamsUserReference(session.user),
      });
      await fetchCaseNotes();
    } catch (error) {
      globalAlert?.error('Failed to create note');
      throw error;
    }
  }

  async function handleUpdateNote(noteId: string, noteData: NoteInput) {
    const session = LocalStorage.getSession();
    if (!session?.user) {
      globalAlert?.error('User session not found');
      return;
    }

    try {
      await Api2.putCaseNote({
        id: noteId,
        caseId,
        title: noteData.title,
        content: noteData.content,
        updatedBy: getCamsUserReference(session.user),
      });
      await fetchCaseNotes();
    } catch (error) {
      globalAlert?.error('Failed to update note');
      throw error;
    }
  }

  async function handleDeleteNote(noteId: string) {
    const session = LocalStorage.getSession();
    if (!session?.user) {
      globalAlert?.error('User session not found');
      return;
    }

    try {
      await Api2.deleteCaseNote({
        id: noteId,
        caseId,
        updatedBy: getCamsUserReference(session.user),
      });
      await fetchCaseNotes();
    } catch (error) {
      globalAlert?.error('Failed to delete note');
      throw error;
    }
  }

  useEffect(() => {
    fetchCaseNotes();
  }, [caseId]);

  return (
    <Notes
      entityId={caseId}
      title="Case Notes"
      notes={caseNotes.map((note) => ({ ...note, entityId: note.caseId }))}
      isLoading={areNotesLoading}
      onCreateNote={handleCreateNote}
      onUpdateNote={handleUpdateNote}
      onDeleteNote={handleDeleteNote}
      createDraftKey={`case-notes-${caseId}`}
      editDraftKeyPrefix={`case-notes-${caseId}`}
      editAction={Actions.EditNote}
      removeAction={Actions.RemoveNote}
      emptyMessage="No notes exist for this case."
    />
  );
}
