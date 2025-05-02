import './CaseNotes.scss';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { TextAreaRef } from '@/lib/type-declarations/input-fields';
import { formatDateTime } from '@/lib/utils/datetime';
import { CaseNote } from '@common/cams/cases';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { sanitizeText } from '@/lib/utils/sanitize-text';
import { AlertOptions } from '../CaseDetailCourtDocket';
import { handleHighlight } from '@/lib/utils/highlight-api';
import { OpenModalButton } from '@/lib/components/uswds/modal/OpenModalButton';
import { OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import Icon from '@/lib/components/uswds/Icon';
import CaseNoteFormModal, {
  CaseNoteFormModalRef,
} from '@/case-detail/panels/case-notes/CaseNoteFormModal';
import CaseNoteRemovalModal, { CaseNoteRemovalModalRef } from './CaseNoteRemovalModal';
import Actions from '@common/cams/actions';

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
  const removeConfirmationModalId = 'remove-note-modal';
  const editNoteModalId = 'edit-note-modal';
  const addNoteModalId = 'add-note-modal';

  const MINIMUM_SEARCH_CHARACTERS = 3;

  function mapArchiveButtonRefs() {
    openArchiveModalButtonRefs.current =
      caseNotes?.map(
        (_, index) => openArchiveModalButtonRefs.current[index] ?? { current: null },
      ) || [];
  }

  function mapEditButtonRefs() {
    if (!caseNotes) return;

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

  function showCaseNotes(note: CaseNote, idx: number) {
    const sanitizedCaseNote = sanitizeText(note.content);
    const sanitizedCaseNoteTitle = sanitizeText(note.title);

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
                title: note.title,
                content: note.content,
                callback: onUpdateNoteRequest,
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
      return showCaseNotes(note, idx);
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

  return (
    <div className="case-notes-panel">
      <div className="case-notes-title">
        <h3>Case Notes</h3>
        <OpenModalButton
          className="add-button"
          id={'case-note-add-button'}
          uswdsStyle={UswdsButtonStyle.Default}
          modalId={addNoteModalId}
          modalRef={caseNoteModalRef}
          ref={openAddModalButtonRef}
          openProps={{
            caseId,
            buttonId: `case-note-add-button`,
            callback: onUpdateNoteRequest,
          }}
          onClick={() => {
            setFocusId('');
          }}
          ariaLabel={`Add new note`}
        >
          <Icon name="add_circle_outline" className="add-circle-outline-icon" />
          Add
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
      <CaseNoteFormModal ref={caseNoteModalRef} modalId="case-note-modal"></CaseNoteFormModal>
      <CaseNoteRemovalModal
        ref={removeConfirmationModalRef}
        modalId={removeConfirmationModalId}
      ></CaseNoteRemovalModal>
    </div>
  );
}

const CaseNotes = forwardRef(_CaseNotes);

export default CaseNotes;
