import './TrusteeNotes.scss';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { formatDateTime } from '@/lib/utils/datetime';
import { TrusteeNote, TrusteeNoteInput } from '@common/cams/trustee-notes';
import { filterTrusteeNotes, SortOrder, sortTrusteeNotes } from './trustee-notes-search-criteria';
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
import TrusteeNoteFormModal, {
  buildTrusteeNoteFormKey,
  TrusteeNoteFormModalRef,
  TrusteeNoteFormMode,
} from '@/trustees/panels/trustee-notes/TrusteeNoteFormModal';
import TrusteeNoteRemovalModal, { TrusteeNoteRemovalModalRef } from './TrusteeNoteRemovalModal';
import Actions from '@common/cams/actions';
import LocalFormCache from '@/lib/utils/local-form-cache';
import { Cacheable } from '@/lib/utils/local-cache';
import Api2 from '@/lib/models/api2';
import { NoteItem } from '@/lib/components/cams/NoteItem/NoteItem';

type TrusteeNotesRef = {
  focusEditButton: (noteId: string) => void;
};

interface TrusteeNotesProps {
  trusteeId: string;
}

function TrusteeNotes_(props: TrusteeNotesProps, ref: React.Ref<TrusteeNotesRef>) {
  const { trusteeId } = props;
  const removeConfirmationModalRef = useRef<TrusteeNoteRemovalModalRef>(null);
  const trusteeNoteModalRef = useRef<TrusteeNoteFormModalRef>(null);
  const openArchiveModalButtonRefs = useRef<React.RefObject<OpenModalButtonRef | null>[]>([]);
  const openAddModalButtonRef = useRef<OpenModalButtonRef>(null);
  const openEditModalButtonRefs = useRef(
    new Map<string, React.RefObject<OpenModalButtonRef | null>>(),
  );

  const [trusteeNotes, setTrusteeNotes] = useState<TrusteeNote[]>([]);
  const [areTrusteeNotesLoading, setAreTrusteeNotesLoading] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState<Cacheable<TrusteeNoteInput> | null>(null);
  const [editDrafts, setEditDrafts] = useState<Cacheable<TrusteeNoteInput>[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const removeConfirmationModalId = 'trustee-remove-note-modal';
  const trusteeNoteModalId = 'trustee-note-modal';

  useMemo(mapArchiveButtonRefs, [trusteeNotes]);
  useMemo(mapEditButtonRefs, [trusteeNotes]);

  const trusteeNotesRecords = useMemo(() => {
    const sortedNotes = sortTrusteeNotes(trusteeNotes, sortOrder);
    return filterTrusteeNotes(sortedNotes, searchQuery);
  }, [trusteeNotes, sortOrder, searchQuery]);

  function mapArchiveButtonRefs() {
    openArchiveModalButtonRefs.current =
      trusteeNotes?.map(
        (_, index) => openArchiveModalButtonRefs.current[index] ?? { current: null },
      ) || [];
  }

  function mapEditButtonRefs() {
    if (!trusteeNotes) {
      return;
    }

    const newRefs = new Map<string, React.RefObject<OpenModalButtonRef | null>>();

    trusteeNotes.forEach((note) => {
      if (note.id) {
        if (!openEditModalButtonRefs.current.has(note.id)) {
          openEditModalButtonRefs.current.set(note.id, { current: null });
        }
        newRefs.set(note.id, openEditModalButtonRefs.current.get(note.id)!);
      }
    });

    openEditModalButtonRefs.current = newRefs;
  }

  async function fetchTrusteeNotes(noteId?: string) {
    setAreTrusteeNotesLoading(true);
    Api2.getTrusteeNotes(trusteeId)
      .then((response) => {
        setTrusteeNotes(response.data ?? []);
        if (noteId) {
          setFocusId(noteId);
        }
      })
      .catch(() => {
        setTrusteeNotes([]);
      })
      .finally(() => setAreTrusteeNotesLoading(false));
  }

  function renderTrusteeNotes() {
    return trusteeNotesRecords.map((note, idx: number) => {
      const formKey = buildTrusteeNoteFormKey(note.trusteeId, 'edit', note.id ?? '');
      const draft = LocalFormCache.getForm<TrusteeNoteInput>(formKey);

      return (
        <NoteItem
          key={idx}
          note={note}
          idx={idx}
          layout="trustee-note"
          draft={draft}
          editAction={Actions.EditTrusteeNote}
          removeAction={Actions.RemoveTrusteeNote}
          modalId={trusteeNoteModalId}
          removeModalId={removeConfirmationModalId}
          modalRef={trusteeNoteModalRef}
          removeModalRef={removeConfirmationModalRef}
          editButtonRef={openEditModalButtonRefs.current.get(note.id!)}
          removeButtonRef={openArchiveModalButtonRefs.current[idx]}
          editButtonProps={{
            id: note.id,
            trusteeId: note.trusteeId,
            buttonId: `trustee-note-edit-button-${idx}`,
            title: draft?.value.title ?? note.title,
            content: draft?.value.content ?? note.content,
            callback: fetchTrusteeNotes,
            initialTitle: note.title,
            initialContent: note.content,
            mode: 'edit',
          }}
          removeButtonProps={{
            id: note.id,
            trusteeId: note.trusteeId,
            buttonId: `trustee-note-remove-button-${idx}`,
            callback: fetchTrusteeNotes,
            initialTitle: note.title,
            initialContent: note.content,
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
    const pattern = /^trustee-notes-[a-zA-Z0-9-]+-[a-zA-Z0-9-]+-/;
    return LocalFormCache.getFormsByPattern<TrusteeNoteInput>(pattern);
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
    const draftNote = LocalFormCache.getForm<TrusteeNoteInput>(`trustee-notes-${trusteeId}`);
    setDraftNote(draftNote);
    setEditDrafts(getEditDrafts().map((form) => form.item));
    fetchTrusteeNotes();
  }, [trusteeId]);

  const handleModalClosed = (eventTrusteeId: string, mode: TrusteeNoteFormMode) => {
    if (eventTrusteeId === trusteeId && mode === 'create') {
      const draftNote = LocalFormCache.getForm<TrusteeNoteInput>(`trustee-notes-${trusteeId}`);
      setDraftNote(draftNote);
    }
    const updatedEditDrafts = getEditDrafts();
    if (updatedEditDrafts.length !== editDrafts?.length) {
      setEditDrafts(updatedEditDrafts.map((form) => form.item));
    }
  };

  function getDraftAlertMessage(draftNote: Cacheable<TrusteeNoteInput>) {
    return `You have a draft trustee note. It will expire on ${formatDateTime(new Date(draftNote.expiresAfter))}.`;
  }

  const hasTrusteeNotes = trusteeNotes && !!trusteeNotes.length;

  return (
    <div className="trustee-notes-panel">
      <div className="trustee-notes-title">
        <h3>Trustee Notes</h3>

        <div className="trustee-notes-controls">
          <div className="trustee-notes-search-and-sort">
            <div className="trustee-notes-search-wrapper">
              <label htmlFor="trustee-notes-search" className="usa-label">
                Find note by title or content
              </label>
              <input
                type="text"
                className="usa-input"
                id="trustee-notes-search"
                name="trustee-notes-search"
                aria-label="Find note by title or content"
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchQuery(value);
                }}
              />
            </div>
            <div className="trustee-notes-sort-wrapper">
              <label htmlFor="trustee-notes-sort" className="usa-label">
                Sort by
              </label>
              <select
                className="usa-select"
                id="trustee-notes-sort"
                name="trustee-notes-sort"
                aria-label="Sort by"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">Title A-Z</option>
              </select>
            </div>
          </div>
          <OpenModalButton
            className="add-button margin-right-0"
            id={'trustee-note-add-button'}
            uswdsStyle={UswdsButtonStyle.Default}
            modalId={trusteeNoteModalId}
            modalRef={trusteeNoteModalRef}
            ref={openAddModalButtonRef}
            openProps={{
              trusteeId,
              title: draftNote?.value.title ?? '',
              content: draftNote?.value.content ?? '',
              buttonId: `trustee-note-add-button`,
              callback: fetchTrusteeNotes,
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
            data-testid="draft-trustee-note-alert-test-id"
            className="draft-notes-alert-container margin-top-3 margin-bottom-0"
          >
            <div className="grid-row">
              <Alert
                id="draft-add-trustee-note"
                message={getDraftAlertMessage(draftNote)}
                type={UswdsAlertStyle.Info}
                role={'status'}
                timeout={0}
                title="Draft Note Available"
                show={true}
                inline={true}
                className="grid-col-8 margin-bottom-0"
              />
              <div className="grid-col-4"></div>
            </div>
          </div>
        )}
        {areTrusteeNotesLoading && (
          <LoadingSpinner id="trustee-notes-loading-indicator" caption="Loading trustee notes..." />
        )}
        {!areTrusteeNotesLoading && (
          <>
            {!hasTrusteeNotes && (
              <div data-testid="empty-trustee-notes-test-id">
                <Alert
                  message="No notes exist for this trustee."
                  type={UswdsAlertStyle.Info}
                  role={'status'}
                  timeout={0}
                  title=""
                  show={true}
                  inline={true}
                />
              </div>
            )}
            {trusteeNotes && trusteeNotes.length > 0 && (
              <ol
                className="search-trustee-notes"
                id="searchable-trustee-notes"
                data-testid="searchable-trustee-notes"
              >
                {renderTrusteeNotes()}
              </ol>
            )}
          </>
        )}
      </div>
      <TrusteeNoteFormModal
        ref={trusteeNoteModalRef}
        modalId={trusteeNoteModalId}
        onModalClosed={handleModalClosed}
      ></TrusteeNoteFormModal>
      <TrusteeNoteRemovalModal
        ref={removeConfirmationModalRef}
        modalId={removeConfirmationModalId}
      ></TrusteeNoteRemovalModal>
    </div>
  );
}

const TrusteeNotes = forwardRef(TrusteeNotes_);
export default TrusteeNotes;
