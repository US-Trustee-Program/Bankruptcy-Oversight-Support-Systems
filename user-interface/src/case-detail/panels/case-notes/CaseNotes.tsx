import './CaseNotes.scss';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { Api2 } from '@/lib/models/api2';
import { TextAreaRef } from '@/lib/type-declarations/input-fields';
import { formatDateTime } from '@/lib/utils/datetime';
import { CaseNote } from '@common/cams/cases';
import { useEffect, useMemo, useRef, useState } from 'react';
import { sanitizeText } from '@/lib/utils/sanitize-text';
import { AlertOptions } from '../CaseDetailCourtDocket';
import { handleHighlight } from '@/lib/utils/highlight-api';
import LocalStorage from '@/lib/utils/local-storage';
import { OpenModalButton } from '@/lib/components/uswds/modal/OpenModalButton';
import { ModalRefType, OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import Modal from '@/lib/components/uswds/modal/Modal';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import Icon from '@/lib/components/uswds/Icon';
import { getCamsUserReference } from '@common/cams/session';
import { CamsUser } from '@common/cams/users';
import CaseNoteModal, { CaseNoteModalRef } from '@/case-detail/panels/case-notes/CaseNoteModal';

export function getCaseNotesInputValue(ref: TextAreaRef | null) {
  return ref?.getValue() ?? '';
}

export interface CaseNotesProps {
  caseId: string;
  areCaseNotesLoading?: boolean;
  hasCaseNotes: boolean;
  caseNotes?: CaseNote[];
  alertOptions?: AlertOptions;
  onUpdateNotesRequest: () => void;
  searchString: string;
}

export default function CaseNotes(props: CaseNotesProps) {
  const { caseId, caseNotes, areCaseNotesLoading, searchString, onUpdateNotesRequest } = props;
  const removeConfirmationModalRef = useRef<ModalRefType>(null);
  const caseNoteModalRef = useRef<CaseNoteModalRef>(null);
  const openArchiveModalButtonRefs = useRef<React.RefObject<OpenModalButtonRef>[]>([]);
  useMemo(() => {
    openArchiveModalButtonRefs.current =
      caseNotes?.map(
        (_, index) => openArchiveModalButtonRefs.current[index] ?? { current: null },
      ) || [];
  }, [caseNotes]);
  const openAddModalButtonRef = useRef<OpenModalButtonRef>(null);
  const openEditModalButtonRefs = useRef<React.RefObject<OpenModalButtonRef>[]>([]);
  useMemo(() => {
    openEditModalButtonRefs.current =
      caseNotes?.map((_, index) => openEditModalButtonRefs.current[index] ?? { current: null }) ||
      [];
  }, [caseNotes]);
  const [noteForRemoval, setNoteForRemoval] = useState<Partial<CaseNote> | null>(null);
  const globalAlert = useGlobalAlert();
  const session = LocalStorage.getSession();
  const removeConfirmationModalId = 'remove-note-modal';
  const editNoteModalId = 'edit-note-modal';
  const addNoteModalId = 'edit-note-modal';

  const api = Api2;

  const MINIMUM_SEARCH_CHARACTERS = 3;

  function handleRemoveSubmitButtonClick() {
    if (noteForRemoval?.id) {
      const newNoteForRemoval = {
        id: noteForRemoval.id,
        caseId: noteForRemoval.caseId,
        updatedBy: getCamsUserReference(session?.user as CamsUser),
      };

      api
        .deleteCaseNote(newNoteForRemoval)
        .then(() => {
          onUpdateNotesRequest();
        })
        .catch(() => {
          globalAlert?.error('There was a problem archiving the note.');
        })
        .finally(() => {
          setNoteForRemoval(null);
        });
    }
  }

  function userCanRemove(note: CaseNote) {
    return session?.user.id === note.updatedBy.id;
  }

  function showCaseNotes(note: CaseNote, idx: number) {
    const sanitizedCaseNote = sanitizeText(note.content);
    const sanitizedCaseTitle = sanitizeText(note.title);

    return (
      <li className="case-note grid-container" key={idx} data-testid={`case-note-${idx}`}>
        <div className="grid-row case-note-title-and-date">
          <div className="grid-col-8">
            <h4
              className="case-note-header usa-tooltip"
              data-testid={`case-note-${idx}-header`}
              title={sanitizedCaseTitle}
              aria-label={`Note Title: ${sanitizedCaseTitle}`}
            >
              {sanitizedCaseTitle}
            </h4>
          </div>
          <div className="case-note-date grid-col-4" data-testid={`case-note-creation-date-${idx}`}>
            {formatDateTime(note.updatedOn)}
          </div>
          <div className="case-note-date grid-col-1"></div>
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
          {userCanRemove(note) && (
            <>
              <OpenModalButton
                className="edit-button"
                id={`case-note-edit-button-${idx}`}
                buttonIndex={`${idx}`}
                uswdsStyle={UswdsButtonStyle.Unstyled}
                modalId={editNoteModalId}
                modalRef={caseNoteModalRef}
                ref={openEditModalButtonRefs.current[idx]}
                openProps={{
                  id: note.id,
                  caseId: note.caseId,
                  buttonId: `case-note-edit-button-${idx}`,
                  title: note.title,
                  content: note.content,
                  callback: onUpdateNotesRequest,
                }}
                ariaLabel={`Edit note titled ${note.title}`}
              >
                <Icon name="edit" className="edit-icon" />
                Edit
              </OpenModalButton>
              <OpenModalButton
                className="remove-button"
                id={`case-note-remove-button-${idx}`}
                buttonIndex={`${idx}`}
                uswdsStyle={UswdsButtonStyle.Unstyled}
                modalId={removeConfirmationModalId}
                modalRef={removeConfirmationModalRef}
                ref={openArchiveModalButtonRefs.current[idx]}
                openProps={{
                  id: note.id,
                  caseId: note.caseId,
                  buttonId: `case-note-remove-button-${idx}`,
                }}
                ariaLabel={`Remove note titled ${note.title}`}
                onClick={() => setNoteForRemoval(note)}
              >
                <Icon name="remove_circle" className="remove-icon" />
                Remove
              </OpenModalButton>
            </>
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

  const removeConfirmationButtonGroup: SubmitCancelBtnProps = {
    modalId: removeConfirmationModalId,
    modalRef: removeConfirmationModalRef as React.RefObject<ModalRefType>,
    submitButton: {
      label: 'Remove',
      onClick: handleRemoveSubmitButtonClick,
      disabled: false,
      closeOnClick: true,
    },
    cancelButton: {
      label: 'Cancel',
    },
  };

  useEffect(() => {
    handleHighlight(
      window,
      document,
      'searchable-case-notes',
      searchString,
      MINIMUM_SEARCH_CHARACTERS,
    );
  }, [searchString, caseNotes]);

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
            callback: onUpdateNotesRequest,
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
              <ol id="searchable-case-notes" data-testid="searchable-case-notes">
                {renderCaseNotes()}
              </ol>
            )}
          </>
        )}
      </div>
      <CaseNoteModal ref={caseNoteModalRef} modalId="case-note-modal"></CaseNoteModal>
      <Modal
        ref={removeConfirmationModalRef}
        modalId={removeConfirmationModalId}
        className="remove-note-confirmation-modal"
        heading="Remove note?"
        content="Would you like to remove this note? This action cannot be undone."
        actionButtonGroup={removeConfirmationButtonGroup}
      ></Modal>
    </div>
  );
}
