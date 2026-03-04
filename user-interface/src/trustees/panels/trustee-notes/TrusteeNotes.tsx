import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { TrusteeNote } from '@common/cams/trustee-notes';
import { NoteInput } from '@/lib/components/cams/Notes/types';
import { getCamsUserReference } from '@common/cams/session';
import LocalStorage from '@/lib/utils/local-storage';
import Actions from '@common/cams/actions';
import Notes from '@/lib/components/cams/Notes/Notes';

interface TrusteeNotesProps {
  trusteeId: string;
}

export default function TrusteeNotes({ trusteeId }: TrusteeNotesProps) {
  const [trusteeNotes, setTrusteeNotes] = useState<TrusteeNote[]>([]);
  const [areNotesLoading, setAreNotesLoading] = useState<boolean>(false);
  const globalAlert = useGlobalAlert();

  async function fetchTrusteeNotes() {
    setAreNotesLoading(true);
    try {
      const response = await Api2.getTrusteeNotes(trusteeId);
      setTrusteeNotes(response.data ?? []);
    } catch (_error) {
      globalAlert?.error('Could not load trustee notes');
      setTrusteeNotes([]);
    } finally {
      setAreNotesLoading(false);
    }
  }

  //LOST PR FEEDBACK: There was a refactor that merged the create and the update.
  async function handleCreateNote(noteData: NoteInput) {
    const session = LocalStorage.getSession();
    if (!session?.user) {
      globalAlert?.error('User session not found');
      return;
    }

    try {
      await Api2.postTrusteeNote({
        trusteeId,
        title: noteData.title,
        content: noteData.content,
        updatedBy: getCamsUserReference(session.user),
      });
      await fetchTrusteeNotes();
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
      await Api2.putTrusteeNote({
        id: noteId,
        trusteeId,
        title: noteData.title,
        content: noteData.content,
        updatedBy: getCamsUserReference(session.user),
      });
      await fetchTrusteeNotes();
    } catch (error) {
      globalAlert?.error('Failed to update note');
      throw error;
    }
  }
  //----------

  async function handleDeleteNote(noteId: string) {
    const session = LocalStorage.getSession();
    if (!session?.user) {
      globalAlert?.error('User session not found');
      return;
    }

    try {
      await Api2.deleteTrusteeNote({
        id: noteId,
        trusteeId,
        updatedBy: getCamsUserReference(session.user),
      });
      await fetchTrusteeNotes();
    } catch (error) {
      globalAlert?.error('Failed to delete note');
      throw error;
    }
  }

  useEffect(() => {
    fetchTrusteeNotes();
  }, [trusteeId]);

  return (
    <Notes
      entityId={trusteeId}
      title="Trustee Notes"
      notes={trusteeNotes.map((note) => ({ ...note, entityId: note.trusteeId }))}
      isLoading={areNotesLoading}
      onCreateNote={handleCreateNote}
      onUpdateNote={handleUpdateNote}
      onDeleteNote={handleDeleteNote}
      createDraftKey={`trustee-notes-${trusteeId}`}
      editDraftKeyPrefix={`trustee-notes-${trusteeId}`}
      editAction={Actions.EditTrusteeNote}
      removeAction={Actions.RemoveTrusteeNote}
      emptyMessage="No notes exist for this trustee."
    />
  );
}
