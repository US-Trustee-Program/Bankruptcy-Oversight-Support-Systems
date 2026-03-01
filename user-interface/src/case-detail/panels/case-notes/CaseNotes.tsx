import './CaseNotes.scss';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { TextAreaRef } from '@/lib/type-declarations/input-fields';
import { formatDateTime } from '@/lib/utils/datetime';
import { CaseNote, CaseNoteInput } from '@common/cams/cases';
import { AlertOptions } from '@/case-detail/panels/CaseDetailCourtDocket';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { handleHighlight } from '@/lib/utils/highlight-api';
import OpenModalButton from '@/lib/components/uswds/modal/OpenModalButton';
import { OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import Icon from '@/lib/components/uswds/Icon';
import CaseNoteFormModal, {
  buildCaseNoteFormKey,
  CaseNoteFormModalRef,
  CaseNoteFormMode,
} from '@/case-detail/panels/case-notes/CaseNoteFormModal';
import CaseNoteRemovalModal, { CaseNoteRemovalModalRef } from './CaseNoteRemovalModal';
import Actions from '@common/cams/actions';
import LocalFormCache from '@/lib/utils/local-form-cache';
import { Cacheable } from '@/lib/utils/local-cache';
import { NoteItem } from '@/lib/components/cams/NoteItem/NoteItem';

export function getCaseNotesInputValue(ref: TextAreaRef | null) {
  return ref?.getValue() ?? '';
}

export type CaseNotesRef = {
  focusEditButton: (noteId: string) => void;
};

export interface CaseNotesProps {
  caseId: string;
  areCaseNotesLoading?: boolean;
  hasCaseNotes: boolean;
  caseNotes?: CaseNote[];
  alertOptions?: AlertOptions;
  onUpdateNoteRequest: (noteId?: string) => void;
  searchString: string;
}

function CaseNotes_(props: CaseNotesProps, ref: React.Ref<CaseNotesRef>) {
  const { caseId, caseNotes, areCaseNotesLoading, searchString, onUpdateNoteRequest } = props;
  const removeConfirmationModalRef = useRef<CaseNoteRemovalModalRef>(null);
  const caseNoteModalRef = useRef<CaseNoteFormModalRef>(null);
  const openArchiveModalButtonRefs = useRef<React.RefObject<OpenModalButtonRef | null>[]>([]);
  const openAddModalButtonRef = useRef<OpenModalButtonRef>(null);
  const openEditModalButtonRefs = useRef(
    new Map<string, React.RefObject<OpenModalButtonRef | null>>(),
  );
  useMemo(mapArchiveButtonRefs, [caseNotes]);
  useMemo(mapEditButtonRefs, [caseNotes]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState<Cacheable<CaseNoteInput> | null>(null);
  const [editDrafts, setEditDrafts] = useState<Cacheable<CaseNoteInput>[] | null>(null);
  const removeConfirmationModalId = 'remove-note-modal';
  const caseNoteModalId = 'case-note-modal';

  const MINIMUM_SEARCH_CHARACTERS = 3;

  function mapArchiveButtonRefs() {
    openArchiveModalButtonRefs.current =
      caseNotes?.map(
        (_, index) => openArchiveModalButtonRefs.current[index] ?? { current: null },
      ) || [];
  }

  function mapEditButtonRefs() {
    if (!caseNotes) {
      return;
    }

    const newRefs = new Map<string, React.RefObject<OpenModalButtonRef | null>>();

    caseNotes.forEach((caseNote) => {
      if (caseNote.id) {
        if (!openEditModalButtonRefs.current.has(caseNote.id)) {
          openEditModalButtonRefs.current.set(caseNote.id, { current: null });
        }
        newRefs.set(caseNote.id, openEditModalButtonRefs.current.get(caseNote.id)!);
      }
    });

    openEditModalButtonRefs.current = newRefs;
  }

  function renderCaseNotes() {
    return caseNotes?.map((note, idx: number) => {
      const formKey = buildCaseNoteFormKey(note.caseId, 'edit', note.id ?? '');
      const draft = LocalFormCache.getForm<CaseNoteInput>(formKey);

      return (
        <NoteItem
          key={idx}
          note={note}
          idx={idx}
          layout="case-note"
          draft={draft}
          editAction={Actions.EditNote}
          removeAction={Actions.RemoveNote}
          modalId={caseNoteModalId}
          removeModalId={removeConfirmationModalId}
          modalRef={caseNoteModalRef}
          removeModalRef={removeConfirmationModalRef}
          editButtonRef={openEditModalButtonRefs.current.get(note.id!)}
          removeButtonRef={openArchiveModalButtonRefs.current[idx]}
          editButtonProps={{
            id: note.id,
            caseId: note.caseId,
            buttonId: `case-note-edit-button-${idx}`,
            title: draft?.value.title ?? note.title,
            content: draft?.value.content ?? note.content,
            callback: onUpdateNoteRequest,
            initialTitle: note.title,
            initialContent: note.content,
            mode: 'edit',
          }}
          removeButtonProps={{
            id: note.id,
            caseId: note.caseId,
            buttonId: `case-note-remove-button-${idx}`,
            callback: onUpdateNoteRequest,
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

  function focus() {
    if (caseNotes?.[0].id) {
      setFocusId(caseNotes[0].id);
    }
  }

  function getEditDrafts() {
    const pattern = /^case-notes-[\dA-Z]{3}-\d{2}-\d{5}-/;
    return LocalFormCache.getFormsByPattern<CaseNoteInput>(pattern);
  }

  useImperativeHandle(ref, () => {
    return {
      focus,
      focusEditButton,
    };
  });

  useEffect(() => {
    handleHighlight(
      window,
      document,
      'searchable-case-notes',
      searchString,
      MINIMUM_SEARCH_CHARACTERS,
    );
  }, [searchString, caseNotes]);

  useEffect(() => {
    if (focusId && openEditModalButtonRefs.current) {
      const ref = openEditModalButtonRefs.current.get(focusId);
      ref?.current?.focus();
    }
  }, [focusId, openEditModalButtonRefs.current]);

  useEffect(() => {
    const draftNote = LocalFormCache.getForm<CaseNoteInput>(`case-notes-${caseId}`);
    setDraftNote(draftNote);
    setEditDrafts(getEditDrafts().map((form) => form.item));
  }, []);

  const handleModalClosed = (eventCaseId: string, mode: CaseNoteFormMode) => {
    if (eventCaseId === caseId && mode === 'create') {
      const draftNote = LocalFormCache.getForm<CaseNoteInput>(`case-notes-${caseId}`);
      setDraftNote(draftNote);
    }
    const updatedEditDrafts = getEditDrafts();
    if (updatedEditDrafts.length !== editDrafts?.length) {
      setEditDrafts(updatedEditDrafts.map((form) => form.item));
    }
  };

  function getDraftAlertMessage(draftNote: Cacheable<CaseNoteInput>) {
    return `You have a draft case note. It will expire on ${formatDateTime(new Date(draftNote.expiresAfter))}.`;
  }

  return (
    <div className="case-notes-panel">
      <div className="case-notes-title">
        <h3>Case Notes</h3>
        {draftNote && (
          <div data-testid="draft-note-alert-test-id" className="draft-notes-alert-container">
            <Alert
              id="draft-add-note"
              message={getDraftAlertMessage(draftNote)}
              type={UswdsAlertStyle.Info}
              role={'status'}
              timeout={0}
              title="Draft Note Available"
              show={true}
              inline={true}
              className="grid-col-8"
            />
          </div>
        )}
        <OpenModalButton
          className="add-button"
          id={'case-note-add-button'}
          uswdsStyle={UswdsButtonStyle.Default}
          modalId={caseNoteModalId}
          modalRef={caseNoteModalRef}
          ref={openAddModalButtonRef}
          openProps={{
            caseId,
            title: draftNote?.value.title ?? '',
            content: draftNote?.value.content ?? '',
            buttonId: `case-note-add-button`,
            callback: onUpdateNoteRequest,
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
        {areCaseNotesLoading && (
          <LoadingSpinner id="notes-loading-indicator" caption="Loading case notes..." />
        )}
        {!areCaseNotesLoading && (
          <>
            {!props.hasCaseNotes && (
              <div data-testid="empty-notes-test-id">
                <Alert
                  message="No notes exist for this case."
                  type={UswdsAlertStyle.Info}
                  role={'status'}
                  timeout={0}
                  title=""
                  show={true}
                  inline={true}
                />
              </div>
            )}
            {caseNotes && caseNotes.length > 0 && (
              <ol
                className="search-case-notes"
                id="searchable-case-notes"
                data-testid="searchable-case-notes"
              >
                {renderCaseNotes()}
              </ol>
            )}
          </>
        )}
      </div>
      <CaseNoteFormModal
        ref={caseNoteModalRef}
        modalId={caseNoteModalId}
        onModalClosed={handleModalClosed}
      ></CaseNoteFormModal>
      <CaseNoteRemovalModal
        ref={removeConfirmationModalRef}
        modalId={removeConfirmationModalId}
      ></CaseNoteRemovalModal>
    </div>
  );
}

const CaseNotes = forwardRef(CaseNotes_);
export default CaseNotes;
