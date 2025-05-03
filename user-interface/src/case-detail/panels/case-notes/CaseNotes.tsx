import './CaseNotes.scss';

import CaseNoteFormModal, {
  CaseNoteFormModalRef,
} from '@/case-detail/panels/case-notes/CaseNoteFormModal';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Icon from '@/lib/components/uswds/Icon';
import { OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import { OpenModalButton } from '@/lib/components/uswds/modal/OpenModalButton';
import { TextAreaRef } from '@/lib/type-declarations/input-fields';
import { formatDateTime } from '@/lib/utils/datetime';
import { handleHighlight } from '@/lib/utils/highlight-api';
import { sanitizeText } from '@/lib/utils/sanitize-text';
import Actions from '@common/cams/actions';
import { CaseNote } from '@common/cams/cases';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import { AlertOptions } from '../CaseDetailCourtDocket';
import CaseNoteRemovalModal, { CaseNoteRemovalModalRef } from './CaseNoteRemovalModal';

export interface CaseNotesProps {
  alertOptions?: AlertOptions;
  areCaseNotesLoading?: boolean;
  caseId: string;
  caseNotes?: CaseNote[];
  hasCaseNotes: boolean;
  onUpdateNoteRequest: (noteId?: string) => void;
  searchString: string;
}

export type CaseNotesRef = {
  focusEditButton: (noteId: string) => void;
};

export function getCaseNotesInputValue(ref: null | TextAreaRef) {
  return ref?.getValue() ?? '';
}

function _CaseNotes(props: CaseNotesProps, ref: React.Ref<CaseNotesRef>) {
  const { areCaseNotesLoading, caseId, caseNotes, onUpdateNoteRequest, searchString } = props;
  const removeConfirmationModalRef = useRef<CaseNoteRemovalModalRef>(null);
  const caseNoteModalRef = useRef<CaseNoteFormModalRef>(null);
  const openArchiveModalButtonRefs = useRef<React.RefObject<OpenModalButtonRef>[]>([]);
  const openAddModalButtonRef = useRef<OpenModalButtonRef>(null);
  const openEditModalButtonRefs = useRef(new Map<string, React.RefObject<OpenModalButtonRef>>());
  useMemo(mapArchiveButtonRefs, [caseNotes]);
  useMemo(mapEditButtonRefs, [caseNotes]);
  const [focusId, setFocusId] = useState<null | string>(null);
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
      <li className="case-note grid-container" data-testid={`case-note-${idx}`} key={idx}>
        <div className="grid-row case-note-title-and-date">
          <div className="grid-col-8">
            <h4
              aria-label={`Note Title: ${sanitizedCaseNoteTitle}`}
              className="case-note-header usa-tooltip"
              data-testid={`case-note-${idx}-header`}
              title={sanitizedCaseNoteTitle}
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
              aria-label="full text of case note"
              className="note-content"
              data-testid={`case-note-${idx}-text`}
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
              ariaLabel={`Edit note titled ${note.title}`}
              buttonIndex={`${idx}`}
              className="edit-button"
              id={`case-note-edit-button`}
              modalId={editNoteModalId}
              modalRef={caseNoteModalRef}
              openProps={{
                buttonId: `case-note-edit-button-${idx}`,
                callback: onUpdateNoteRequest,
                caseId: note.caseId,
                content: note.content,
                id: note.id,
                title: note.title,
              }}
              ref={openEditModalButtonRefs.current.get(note.id!)}
              uswdsStyle={UswdsButtonStyle.Unstyled}
            >
              <Icon className="edit-icon" name="edit" />
              Edit
            </OpenModalButton>
          )}
          {Actions.contains(note, Actions.RemoveNote) && (
            <OpenModalButton
              ariaLabel={`Remove note titled ${note.title}`}
              buttonIndex={`${idx}`}
              className="remove-button"
              id={`case-note-remove-button`}
              modalId={removeConfirmationModalId}
              modalRef={removeConfirmationModalRef}
              openProps={{
                buttonId: `case-note-remove-button-${idx}`,
                callback: onUpdateNoteRequest,
                caseId: note.caseId,
                id: note.id,
              }}
              ref={openArchiveModalButtonRefs.current[idx]}
              uswdsStyle={UswdsButtonStyle.Unstyled}
            >
              <Icon className="remove-icon" name="remove_circle" />
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
          ariaLabel={`Add new note`}
          className="add-button"
          id={'case-note-add-button'}
          modalId={addNoteModalId}
          modalRef={caseNoteModalRef}
          onClick={() => {
            setFocusId('');
          }}
          openProps={{
            buttonId: `case-note-add-button`,
            callback: onUpdateNoteRequest,
            caseId,
          }}
          ref={openAddModalButtonRef}
          uswdsStyle={UswdsButtonStyle.Default}
        >
          <Icon className="add-circle-outline-icon" name="add_circle_outline" />
          Add
        </OpenModalButton>
        {areCaseNotesLoading && (
          <LoadingSpinner caption="Loading case notes..." id="notes-loading-indicator" />
        )}
        {!areCaseNotesLoading && (
          <>
            {!props.hasCaseNotes && (
              <div data-testid="empty-notes-test-id">
                <Alert
                  inline={true}
                  message="No notes exist for this case."
                  role={'status'}
                  show={true}
                  timeout={0}
                  title=""
                  type={UswdsAlertStyle.Info}
                />
              </div>
            )}
            {caseNotes && caseNotes.length > 0 && (
              <ol
                className="search-case-notes"
                data-testid="searchable-case-notes"
                id="searchable-case-notes"
              >
                {renderCaseNotes()}
              </ol>
            )}
          </>
        )}
      </div>
      <CaseNoteFormModal modalId="case-note-modal" ref={caseNoteModalRef}></CaseNoteFormModal>
      <CaseNoteRemovalModal
        modalId={removeConfirmationModalId}
        ref={removeConfirmationModalRef}
      ></CaseNoteRemovalModal>
    </div>
  );
}

const CaseNotes = forwardRef(_CaseNotes);

export default CaseNotes;
