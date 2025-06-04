import './CaseNotes.scss';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { TextAreaRef } from '@/lib/type-declarations/input-fields';
import { formatDateTime } from '@/lib/utils/datetime';
import { CaseNote, CaseNoteInput } from '@common/cams/cases';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { sanitizeText } from '@/lib/utils/sanitize-text';
import { AlertOptions } from '../CaseDetailCourtDocket';
import { handleHighlight } from '@/lib/utils/highlight-api';
import { OpenModalButton } from '@/lib/components/uswds/modal/OpenModalButton';
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
import useFeatureFlags, {
  DRAFT_CASE_NOTE_ALERT_ENABLED,
  EDIT_CASE_NOTE_DRAFT_ALERT_ENABLED,
} from '@/lib/hooks/UseFeatureFlags';

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

function _CaseNotes(props: CaseNotesProps, ref: React.Ref<CaseNotesRef>) {
  const { caseId, caseNotes, areCaseNotesLoading, searchString, onUpdateNoteRequest } = props;
  const removeConfirmationModalRef = useRef<CaseNoteRemovalModalRef>(null);
  const caseNoteModalRef = useRef<CaseNoteFormModalRef>(null);
  const openArchiveModalButtonRefs = useRef<React.RefObject<OpenModalButtonRef>[]>([]);
  const openAddModalButtonRef = useRef<OpenModalButtonRef>(null);
  const openEditModalButtonRefs = useRef(new Map<string, React.RefObject<OpenModalButtonRef>>());
  useMemo(mapArchiveButtonRefs, [caseNotes]);
  useMemo(mapEditButtonRefs, [caseNotes]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState<Cacheable<CaseNoteInput> | null>(null);
  const [editDrafts, setEditDrafts] = useState<Cacheable<CaseNoteInput>[] | null>(null);
  const removeConfirmationModalId = 'remove-note-modal';
  const editNoteModalId = 'edit-note-modal';
  const addNoteModalId = 'add-note-modal';

  const MINIMUM_SEARCH_CHARACTERS = 3;

  const featureFlags = useFeatureFlags();
  const draftNoteAlertEnabledFlag = featureFlags[DRAFT_CASE_NOTE_ALERT_ENABLED];
  const editNoteDraftAlertEnabledFlag = featureFlags[EDIT_CASE_NOTE_DRAFT_ALERT_ENABLED];

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

    const newRefs = new Map<string, React.RefObject<OpenModalButtonRef>>();

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

  function showCaseNote(note: CaseNote, idx: number) {
    const sanitizedCaseNote = sanitizeText(note.content);
    const sanitizedCaseNoteTitle = sanitizeText(note.title);
    let draft: Cacheable<CaseNoteInput> | null = null;
    if (editNoteDraftAlertEnabledFlag) {
      const formKey = buildCaseNoteFormKey(note.caseId, 'edit', note.id ?? '');
      draft = LocalFormCache.getForm<CaseNoteInput>(formKey);
    }

    return (
      <li className="case-note grid-container" key={idx} data-testid={`case-note-${idx}`}>
        <div className="grid-row case-note-title-and-date">
          <div className="grid-col-8">
            <h4
              className="case-note-header usa-tooltip"
              data-testid={`case-note-${idx}-header`}
              title={sanitizedCaseNoteTitle}
              aria-label={`Note Title: ${sanitizedCaseNoteTitle}`}
            >
              {sanitizedCaseNoteTitle}
            </h4>
          </div>
          <div className="case-note-date grid-col-4" data-testid={`case-note-creation-date-${idx}`}>
            {note.previousVersionId ? 'Edited on: ' : 'Created on: '}
            {formatDateTime(note.updatedOn)}
          </div>
        </div>
        <div className="grid-row">
          <div className="grid-col-12 case-note-content">
            <div
              className="note-content"
              data-testid={`case-note-${idx}-text`}
              aria-label="full text of case note"
            >
              {sanitizedCaseNote}
            </div>
          </div>
        </div>
        <div className="case-note-author" data-testid={`case-note-author-${idx}`}>
          {note.updatedBy.name}
        </div>
        {editNoteDraftAlertEnabledFlag && draft && (
          <Alert
            message={`You have a draft edit. It will expire on ${formatDateTime(new Date(draft.expiresAfter))}.`}
            type={UswdsAlertStyle.Info}
            role={'status'}
            timeout={0}
            title="Draft Note Available"
            show={true}
            inline={true}
            slim={true}
            className="grid-col-8"
          />
        )}
        <div className="case-note-toolbar" data-testid={`case-note-toolbar-${idx}`}>
          {Actions.contains(note, Actions.EditNote) && (
            <OpenModalButton
              className="edit-button"
              id={`case-note-edit-button`}
              buttonIndex={`${idx}`}
              uswdsStyle={UswdsButtonStyle.Unstyled}
              modalId={editNoteModalId}
              modalRef={caseNoteModalRef}
              ref={openEditModalButtonRefs.current.get(note.id!)}
              openProps={{
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
              ariaLabel={`Edit note titled ${note.title}`}
            >
              <Icon name="edit" className="edit-icon" />
              Edit
            </OpenModalButton>
          )}
          {Actions.contains(note, Actions.RemoveNote) && (
            <OpenModalButton
              className="remove-button"
              id={`case-note-remove-button`}
              buttonIndex={`${idx}`}
              uswdsStyle={UswdsButtonStyle.Unstyled}
              modalId={removeConfirmationModalId}
              modalRef={removeConfirmationModalRef}
              ref={openArchiveModalButtonRefs.current[idx]}
              openProps={{
                id: note.id,
                caseId: note.caseId,
                buttonId: `case-note-remove-button-${idx}`,
                callback: onUpdateNoteRequest,
                initialTitle: note.title,
                initialContent: note.content,
              }}
              ariaLabel={`Remove note titled ${note.title}`}
            >
              <Icon name="remove_circle" className="remove-icon" />
              Remove
            </OpenModalButton>
          )}
        </div>
      </li>
    );
  }

  function renderCaseNotes() {
    return caseNotes?.map((note, idx: number) => {
      return showCaseNote(note, idx);
    });
  }

  function focusEditButton(noteId: string) {
    setFocusId(noteId);
  }

  function focus() {
    if (caseNotes && caseNotes[0].id) {
      setFocusId(caseNotes[0].id);
    }
  }

  function getEditDrafts() {
    // TODO: Is there a way we can leverage VALID_CASEID_PATTERN well?
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
    if (editNoteDraftAlertEnabledFlag) {
      const updatedEditDrafts = getEditDrafts();
      if (updatedEditDrafts.length !== editDrafts?.length) {
        setEditDrafts(updatedEditDrafts.map((form) => form.item));
      }
    }
  };

  return (
    <div className="case-notes-panel">
      <div className="case-notes-title">
        <h3>Case Notes</h3>
        {draftNoteAlertEnabledFlag && draftNote && (
          <div data-testid="draft-note-alert-test-id" className="draft-notes-alert-container">
            <Alert
              message={`You have a draft case note. It will expire on ${formatDateTime(new Date(draftNote.expiresAfter))}.`}
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
          modalId={addNoteModalId}
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
        modalId="case-note-modal"
        onModalClosed={handleModalClosed}
      ></CaseNoteFormModal>
      <CaseNoteRemovalModal
        ref={removeConfirmationModalRef}
        modalId={removeConfirmationModalId}
      ></CaseNoteRemovalModal>
    </div>
  );
}

const CaseNotes = forwardRef(_CaseNotes);

export default CaseNotes;
