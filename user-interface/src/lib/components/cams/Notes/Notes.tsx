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
import NoteRemovalModal, { NoteRemovalModalRef } from './NoteRemovalModal';
import { handleHighlight } from '@/lib/utils/highlight-api';

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
  } = props;

  const removeConfirmationModalRef = useRef<NoteRemovalModalRef>(null);
  const noteModalRef = useRef<NoteFormModalRef>(null);
  const openArchiveModalButtonRefs = useRef<React.RefObject<OpenModalButtonRef | null>[]>([]);
  const openAddModalButtonRef = useRef<OpenModalButtonRef>(null);
  const openEditModalButtonRefs = useRef(
    new Map<string, React.RefObject<OpenModalButtonRef | null>>(),
  );

  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState<Cacheable<NoteInput> | null>(null);
  const [editDrafts, setEditDrafts] = useState<Cacheable<NoteInput>[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const removeConfirmationModalId = 'note-remove-modal';
  const noteModalId = 'note-modal';

  useMemo(mapArchiveButtonRefs, [notes]);
  useMemo(mapEditButtonRefs, [notes]);

  const filteredAndSortedNotes = useMemo(() => {
    const sorted = sortNotes(notes, sortOrder);
    return filterNotes(sorted, searchQuery);
  }, [notes, sortOrder, searchQuery]);

  function mapArchiveButtonRefs() {
    openArchiveModalButtonRefs.current =
      notes?.map((_, index) => openArchiveModalButtonRefs.current[index] ?? { current: null }) ||
      [];
  }

  function mapEditButtonRefs() {
    if (!notes) {
      return;
    }

    const newRefs = new Map<string, React.RefObject<OpenModalButtonRef | null>>();

    notes.forEach((note) => {
      if (note.id) {
        if (!openEditModalButtonRefs.current.has(note.id)) {
          openEditModalButtonRefs.current.set(note.id, { current: null });
        }
        newRefs.set(note.id, openEditModalButtonRefs.current.get(note.id)!);
      }
    });

    openEditModalButtonRefs.current = newRefs;
  }

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

  function renderNotes() {
    return filteredAndSortedNotes.map((note, idx: number) => {
      const formKey = `${editDraftKeyPrefix}-${note.id}`;
      const draft = LocalFormCache.getForm<NoteInput>(formKey);

      return (
        <NoteItem
          key={idx}
          note={note}
          idx={idx}
          draft={draft}
          editAction={editAction}
          removeAction={removeAction}
          modalId={noteModalId}
          removeModalId={removeConfirmationModalId}
          modalRef={noteModalRef}
          removeModalRef={removeConfirmationModalRef}
          editButtonRef={openEditModalButtonRefs.current.get(note.id!)}
          removeButtonRef={openArchiveModalButtonRefs.current[idx]}
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
          }}
          getDraftAlertMessage={getDraftAlertMessage}
        />
      );
    });
  }

  function focusEditButton(noteId: string) {
    setFocusId(noteId);
  }

  function getEditDrafts() {
    const pattern = new RegExp(`^${editDraftKeyPrefix}-`);
    return LocalFormCache.getFormsByPattern<NoteInput>(pattern);
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
  }, [focusId, openEditModalButtonRefs.current]);

  useEffect(() => {
    const draftNote = LocalFormCache.getForm<NoteInput>(createDraftKey);
    setDraftNote(draftNote);
    setEditDrafts(getEditDrafts().map((form) => form.item));
  }, [entityId, createDraftKey, editDraftKeyPrefix]);

  useEffect(() => {
    handleHighlight(
      window,
      document,
      'searchable-notes',
      searchQuery.toLowerCase(),
      MINIMUM_SEARCH_CHARACTERS,
    );
  }, [searchQuery]);

  const handleModalClosed = () => {
    const draftNote = LocalFormCache.getForm<NoteInput>(createDraftKey);
    setDraftNote(draftNote);
    const updatedEditDrafts = getEditDrafts();
    if (updatedEditDrafts.length !== editDrafts?.length) {
      setEditDrafts(updatedEditDrafts.map((form) => form.item));
    }
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
          <div className="notes-search-wrapper">
            <label htmlFor="notes-search" className="usa-label">
              {searchPlaceholder}
            </label>
            <input
              type="text"
              className="usa-input"
              id="notes-search"
              name="notes-search"
              aria-label={searchPlaceholder}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
              }}
            />
          </div>
          <div className="notes-sort-wrapper">
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
            <Icon name="add_circle_outline" className="add-circle-outline-icon" />
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
              <div data-testid="empty-notes">
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
      <NoteRemovalModal
        ref={removeConfirmationModalRef}
        modalId={removeConfirmationModalId}
        onDelete={handleDeleteNote}
      ></NoteRemovalModal>
    </div>
  );
}

const Notes = forwardRef(Notes_);
export default Notes;
