import './Notes.scss';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { formatDateTime } from '@/lib/utils/datetime';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import OpenModalButton from '@/lib/components/uswds/modal/OpenModalButton';
import { OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import Icon from '@/lib/components/uswds/Icon';
import Actions, { Action } from '@common/cams/actions';
import LocalFormCache from '@/lib/utils/local-form-cache';
import { Cacheable } from '@/lib/utils/local-cache';
import { NoteItem } from '@/lib/components/cams/NoteItem/NoteItem';
import { Note, NoteInput } from './types';
import { sortNotes, filterNotes, SortOrder, MINIMUM_SEARCH_CHARACTERS } from './notes-utils';
import NoteFormModal, { NoteFormModalRef } from './NoteFormModal';
import RemovalModal, { RemovalModalRef } from '@/lib/components/uswds/modal/RemovalModal';
import { handleHighlight } from '@/lib/utils/highlight-api';
import Input from '../../uswds/Input';
import { InputRef } from '@/lib/type-declarations/input-fields';

export type NotesRef = {
  focusEditButton: (noteId: string) => void;
};

interface NotesProps {
  entityId: string;
  title: string;
  notes: Note[];
  isLoading: boolean;
  onCreateNote: (noteData: NoteInput) => Promise<void>;
  onUpdateNote: (noteId: string, noteData: NoteInput) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  createDraftKey: string;
  editDraftKeyPrefix: string;
  editAction?: Action;
  removeAction?: Action;
  emptyMessage?: string;
  searchPlaceholder?: string;
  removalObjectName?: string;
}

// Custom hook for search, sort, and highlight logic
function useNotesSearchSortHighlight(notes: Note[]) {
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAndSortedNotes = useMemo(() => {
    const sorted = sortNotes(notes, sortOrder);
    return filterNotes(sorted, searchQuery);
  }, [notes, sortOrder, searchQuery]);

  useEffect(() => {
    handleHighlight(
      window,
      document,
      'searchable-notes',
      searchQuery.toLowerCase(),
      MINIMUM_SEARCH_CHARACTERS,
    );
  }, [searchQuery]);

  return { sortOrder, setSortOrder, searchQuery, setSearchQuery, filteredAndSortedNotes };
}

function Notes_(props: NotesProps, ref: React.Ref<NotesRef>) {
  const {
    entityId,
    title,
    notes,
    isLoading,
    onCreateNote,
    onUpdateNote,
    onDeleteNote,
    createDraftKey,
    editDraftKeyPrefix,
    editAction = Actions.EditNote,
    removeAction = Actions.RemoveNote,
    emptyMessage = 'No notes available.',
    searchPlaceholder = 'Find note by title or content',
    removalObjectName = 'note',
  } = props;

  const removeConfirmationModalRef = useRef<RemovalModalRef>(null);
  const noteModalRef = useRef<NoteFormModalRef>(null);
  // Key remove button refs by note ID (like edit refs) to avoid misalignment when filtering/sorting
  const openRemoveModalButtonRefs = useRef(
    new Map<string, React.RefObject<OpenModalButtonRef | null>>(),
  );
  const openAddModalButtonRef = useRef<OpenModalButtonRef>(null);
  const openEditModalButtonRefs = useRef(
    new Map<string, React.RefObject<OpenModalButtonRef | null>>(),
  );
  const inputRef = useRef<InputRef>(null);

  const [focusId, setFocusId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState<Cacheable<NoteInput> | null>(null);

  const removeConfirmationModalId = 'note-remove-modal';
  const noteModalId = 'note-modal';

  // Use custom hook for search/sort/highlight
  const { sortOrder, setSortOrder, searchQuery, setSearchQuery, filteredAndSortedNotes } =
    useNotesSearchSortHighlight(notes);

  // Convert ref mapping from useMemo to useEffect (proper pattern for side effects)
  useEffect(() => {
    if (!notes) return;

    const newRemoveRefs = new Map<string, React.RefObject<OpenModalButtonRef | null>>();

    notes.forEach((note) => {
      if (!note.id) return;

      if (!openRemoveModalButtonRefs.current.has(note.id)) {
        openRemoveModalButtonRefs.current.set(note.id, { current: null });
      }
      newRemoveRefs.set(note.id, openRemoveModalButtonRefs.current.get(note.id)!);
    });

    openRemoveModalButtonRefs.current = newRemoveRefs;
  }, [notes]);

  useEffect(() => {
    if (!notes) return;

    const newEditRefs = new Map<string, React.RefObject<OpenModalButtonRef | null>>();

    notes.forEach((note) => {
      if (!note.id) return;

      if (!openEditModalButtonRefs.current.has(note.id)) {
        openEditModalButtonRefs.current.set(note.id, { current: null });
      }
      newEditRefs.set(note.id, openEditModalButtonRefs.current.get(note.id)!);
    });

    openEditModalButtonRefs.current = newEditRefs;
  }, [notes]);

  async function handleCreateNote(noteData: NoteInput) {
    await onCreateNote(noteData);
  }

  async function handleUpdateNote(noteData: NoteInput) {
    if (noteData.id) {
      await onUpdateNote(noteData.id, noteData);
    }
  }

  async function handleDeleteNote(noteId: string) {
    await onDeleteNote(noteId);
  }

  function validateInputLength(): string | undefined {
    if (searchQuery && searchQuery.length < MINIMUM_SEARCH_CHARACTERS) {
      return `Must be at least ${MINIMUM_SEARCH_CHARACTERS} characters`;
    }
    return undefined;
  }

  function renderNotes() {
    return filteredAndSortedNotes.map((note, idx: number) => {
      const formKey = `${editDraftKeyPrefix}-${note.id}`;
      const draft = LocalFormCache.getForm<NoteInput>(formKey);

      return (
        <NoteItem
          key={note.id}
          note={note}
          index={idx}
          draft={draft}
          canEdit={Actions.contains(note, editAction)}
          canRemove={Actions.contains(note, removeAction)}
          modalId={noteModalId}
          removeModalId={removeConfirmationModalId}
          modalRef={noteModalRef}
          removeModalRef={removeConfirmationModalRef}
          editButtonRef={openEditModalButtonRefs.current.get(note.id!)}
          removeButtonRef={openRemoveModalButtonRefs.current.get(note.id!)}
          editButtonProps={{
            id: note.id,
            entityId: note.entityId,
            title: draft?.value.title ?? note.title,
            content: draft?.value.content ?? note.content,
            cacheKey: formKey,
            initialTitle: note.title,
            initialContent: note.content,
            mode: 'edit',
          }}
          removeButtonProps={{
            id: note.id,
            buttonId: `note-remove-button-${idx}`,
            onDelete: () => handleDeleteNote(note.id!),
          }}
          getDraftAlertMessage={getDraftAlertMessage}
        />
      );
    });
  }

  function focusEditButton(noteId: string) {
    setFocusId(noteId);
  }

  useImperativeHandle(ref, () => {
    return {
      focusEditButton,
    };
  });

  useEffect(() => {
    if (focusId && openEditModalButtonRefs.current) {
      const editRef = openEditModalButtonRefs.current.get(focusId);
      editRef?.current?.focus();
    }
  }, [focusId]);

  // Simplified: only track the create draft, each NoteItem reads its own edit draft
  useEffect(() => {
    const draftNote = LocalFormCache.getForm<NoteInput>(createDraftKey);
    setDraftNote(draftNote);
  }, [entityId, createDraftKey]);

  // Simplified: only refresh the add-draft on modal close
  const handleModalClosed = () => {
    const draftNote = LocalFormCache.getForm<NoteInput>(createDraftKey);
    setDraftNote(draftNote);
  };

  function getDraftAlertMessage(draftNote: Cacheable<NoteInput>) {
    return `You have a draft note. It will expire on ${formatDateTime(new Date(draftNote.expiresAfter))}.`;
  }

  const hasNotes = notes && !!notes.length;

  return (
    <div className="notes-panel">
      <div className="notes-title">
        <h3>{title}</h3>

        <div className="notes-toolbar">
          <div
            className={`notes-search-wrapper${!validateInputLength() ? ' notes-search-no-error' : ''}`}
          >
            <Input
              type="text"
              id="notes-search"
              name="notes-search"
              label={searchPlaceholder}
              ref={inputRef}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
              }}
              errorMessage={validateInputLength()}
            />
          </div>
          <div className="usa-form-group notes-sort-wrapper">
            <label htmlFor="notes-sort" className="usa-label">
              Sort by
            </label>
            <select
              className="usa-select"
              id="notes-sort"
              name="notes-sort"
              aria-label="Sort by"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title">Title A-Z</option>
            </select>
          </div>
          <OpenModalButton
            className="notes-add-button"
            id={'note-add-button'}
            uswdsStyle={UswdsButtonStyle.Default}
            modalId={noteModalId}
            modalRef={noteModalRef}
            ref={openAddModalButtonRef}
            openProps={{
              entityId,
              title: draftNote?.value.title ?? '',
              content: draftNote?.value.content ?? '',
              cacheKey: createDraftKey,
              initialTitle: '',
              initialContent: '',
              mode: 'create',
            }}
            onClick={() => {
              setFocusId('');
            }}
            ariaLabel={`Add new note`}
          >
            <Icon
              name={draftNote ? 'edit' : 'add_circle_outline'}
              className="add-circle-outline-icon"
            />
            {draftNote ? 'Continue Editing' : 'Add Note'}
          </OpenModalButton>
        </div>

        {draftNote && (
          <div
            data-testid="draft-note-alert"
            className="notes-draft-alert-container margin-top-3 margin-bottom-0"
          >
            <Alert
              id="draft-add-note"
              message={getDraftAlertMessage(draftNote)}
              type={UswdsAlertStyle.Info}
              role={'status'}
              timeout={0}
              title="Draft Note Available"
              show={true}
              inline={true}
            />
          </div>
        )}
        {isLoading && <LoadingSpinner id="notes-loading-indicator" caption="Loading notes..." />}
        {!isLoading && (
          <>
            {!hasNotes && (
              <div data-testid="empty-notes" className="empty-notes">
                <Alert
                  message={emptyMessage}
                  type={UswdsAlertStyle.Info}
                  role={'status'}
                  timeout={0}
                  title=""
                  show={true}
                  inline={true}
                />
              </div>
            )}
            {notes && notes.length > 0 && (
              <ol className="search-notes" id="searchable-notes" data-testid="searchable-notes">
                {renderNotes()}
              </ol>
            )}
          </>
        )}
      </div>
      <NoteFormModal
        ref={noteModalRef}
        modalId={noteModalId}
        onSave={async (noteData) => {
          if (noteData.id) {
            await handleUpdateNote(noteData);
          } else {
            await handleCreateNote(noteData);
          }
        }}
        onModalClosed={handleModalClosed}
      ></NoteFormModal>
      <RemovalModal
        ref={removeConfirmationModalRef}
        modalId={removeConfirmationModalId}
        objectName={removalObjectName}
      />
    </div>
  );
}

const Notes = forwardRef(Notes_);
export default Notes;
