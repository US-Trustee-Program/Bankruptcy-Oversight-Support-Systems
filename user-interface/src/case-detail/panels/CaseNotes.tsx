import './CaseNotes.scss';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Button, { ButtonRef, UswdsButtonStyle } from '@/lib/components/uswds/Button';
import TextArea from '@/lib/components/uswds/TextArea';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { Api2 } from '@/lib/models/api2';
import { TextAreaRef } from '@/lib/type-declarations/input-fields';
import { formatDateTime } from '@/lib/utils/datetime';
import { CaseNote, CaseNoteInput } from '@common/cams/cases';
import { useEffect, useRef, useState } from 'react';
import { sanitizeText } from '@/lib/utils/sanitize-text';
import { HttpResponse } from '@okta/okta-auth-js';
import { HttpStatusCodes } from '../../../../common/src/api/http-status-codes';
import Input from '@/lib/components/uswds/Input';
import { AlertOptions } from './CaseDetailCourtDocket';
import { handleHighlight } from '@/lib/utils/highlight-api';
import LocalFormCache from '@/lib/utils/local-form-cache';
import LocalStorage from '@/lib/utils/local-storage';
import { OpenModalButton } from '@/lib/components/uswds/modal/OpenModalButton';
import { ModalRefType, OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import Modal from '@/lib/components/uswds/modal/Modal';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import Icon from '@/lib/components/uswds/Icon';
import { getCamsUserReference } from '../../../../common/src/cams/session';

function buildCaseNoteFormKey(caseId: string) {
  return `case-notes-${caseId}`;
}

export function getCaseNotesInputValue(ref: TextAreaRef | null) {
  return ref?.getValue() ?? '';
}

export interface CaseNotesProps {
  caseId: string;
  areCaseNotesLoading?: boolean;
  hasCaseNotes: boolean;
  caseNotes?: CaseNote[];
  alertOptions?: AlertOptions;
  onNoteCreation: () => void;
  onNoteArchive: () => void;
  searchString: string;
}

export default function CaseNotes(props: CaseNotesProps) {
  const { caseId, caseNotes, areCaseNotesLoading, searchString } = props;
  const titleInputRef = useRef<TextAreaRef>(null);
  const contentInputRef = useRef<TextAreaRef>(null);
  const submitButtonRef = useRef<ButtonRef>(null);
  const clearButtonRef = useRef<ButtonRef>(null);
  const archiveConfirmationModalRef = useRef<ModalRefType>(null);
  const [openModalButtonRefs] = useState(
    () => new Map<number, React.RefObject<OpenModalButtonRef>>(null),
  );
  const [archiveNote, setArchiveNote] = useState<CaseNote | null>(null);
  const globalAlert = useGlobalAlert();
  const session = LocalStorage.getSession();
  const archiveConfirmationModalId = '';

  const api = Api2;

  const MINIMUM_SEARCH_CHARACTERS = 3;
  const formKey = buildCaseNoteFormKey(caseId);

  function handleTitleChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (session?.user) {
      saveFormData({
        caseId: props.caseId,
        title: event.target.value,
        content: getCaseNotesInputValue(contentInputRef.current),
      });
    }
  }

  function handleContentChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    if (session?.user) {
      saveFormData({
        caseId: props.caseId,
        title: getCaseNotesInputValue(titleInputRef.current),
        content: event.target.value,
      });
    }
  }

  function setupArchive(note: CaseNote) {
    setArchiveNote(note);
  }

  function handleArchiveButtonClick() {
    if (!archiveNote?.id) return;
    const newArchiveNote = {
      id: archiveNote.id,
      caseId: archiveNote.caseId,
      updatedBy: session?.user,
    };
    api
      .patchCaseNoteArchival(newArchiveNote)
      .then(() => {
        if (props.onNoteArchive) props.onNoteArchive();
      })
      .catch(() => {
        globalAlert?.error('There was a problem archiving the note.');
      })
      .finally(() => {
        setArchiveNote(null);
      });
  }

  function userCanArchive(note: CaseNote) {
    return session?.user.id === note.updatedBy.id;
  }

  function setFormButtonState(enabled: boolean) {
    submitButtonRef.current?.disableButton(!enabled);
    clearButtonRef.current?.disableButton(!enabled);
  }

  function saveFormData(data: CaseNoteInput) {
    if (data.title?.length > 0 || data.content?.length > 0) {
      LocalFormCache.saveForm(formKey, data);
      setFormButtonState(true);
    } else {
      LocalFormCache.clearForm(formKey);
      setFormButtonState(false);
    }
  }

  function clearCaseNoteForm() {
    titleInputRef.current?.clearValue();
    contentInputRef.current?.clearValue();
    LocalFormCache.clearForm(formKey);
    setFormButtonState(false);
  }

  function disableFormFields(disabled: boolean) {
    titleInputRef.current?.disable(disabled);
    contentInputRef.current?.disable(disabled);
    setFormButtonState(!disabled);
  }

  async function putCaseNote() {
    const formData = LocalFormCache.getForm(formKey) as CaseNoteInput;
    if (formData.title?.length > 0 && formData.content?.length > 0) {
      disableFormFields(true);
      if (session?.user) {
        const caseNoteInput: CaseNoteInput = {
          caseId: props.caseId,
          title: formData.title,
          content: formData.content,
          updatedBy: getCamsUserReference(session?.user),
        };
        api
          .postCaseNote(caseNoteInput)
          .then(() => {
            if (props.onNoteCreation) props.onNoteCreation();
            disableFormFields(false);
            clearCaseNoteForm();
          })
          .catch((e: HttpResponse) => {
            if (e.status !== HttpStatusCodes.FORBIDDEN) {
              globalAlert?.error('Could not insert case note.');
            }
            disableFormFields(false);
          });
      }
    } else {
      globalAlert?.error('All case note input fields are required to submit a note.');
    }
  }

  function showCaseNotes(note: CaseNote, idx: number) {
    const sanitizedCaseNote = sanitizeText(note.content);
    const sanitizedCaseTitle = sanitizeText(note.title);
    if (!openModalButtonRefs.has(idx)) {
      openModalButtonRefs.set(idx, useRef(null));
    }
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
          {userCanArchive(note) && (
            <OpenModalButton
              className="remove-button"
              id={`case-note-remove-button-${idx}`}
              uswdsStyle={UswdsButtonStyle.Unstyled}
              modalId={archiveConfirmationModalId}
              modalRef={archiveConfirmationModalRef}
              ref={openModalButtonRefs.get(idx)}
              openProps={{
                id: note.id,
                caseId: note.caseId,
                buttonId: `case-note-remove-button-${idx}`,
              }}
              ariaLabel={`Remove note titled ${note.title}`}
              onClick={() => setupArchive(note)}
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

  const archiveConfirmationButtonGroup: SubmitCancelBtnProps = {
    modalId: archiveConfirmationModalId,
    modalRef: archiveConfirmationModalRef as React.RefObject<ModalRefType>,
    submitButton: {
      label: 'Remove',
      onClick: handleArchiveButtonClick,
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

  useEffect(() => {
    const formData = LocalFormCache.getForm(formKey) as CaseNoteInput;
    if (
      formData &&
      formData.caseId === props.caseId &&
      (formData.title?.length > 0 || formData.content?.length > 0)
    ) {
      titleInputRef.current?.setValue(formData.title);
      contentInputRef.current?.setValue(formData.content);
      setFormButtonState(true);
    } else {
      setFormButtonState(false);
    }
  }, []);

  return (
    <div className="case-notes-panel">
      <div className="case-notes-title">
        <h3>Case Notes</h3>
        <div className="case-notes-form-container">
          <Input
            id="case-note-title-input"
            label="Note title"
            required={true}
            includeClearButton={true}
            onChange={handleTitleChange}
            autoComplete="off"
            ref={titleInputRef}
          />
          <TextArea
            id="note-content"
            label="Note Text"
            required={true}
            onChange={handleContentChange}
            ref={contentInputRef}
          />
          <div className="form-button-bar">
            <Button
              id="submit-case-note"
              uswdsStyle={UswdsButtonStyle.Default}
              onClick={putCaseNote}
              aria-label="Add case note."
              ref={submitButtonRef}
            >
              Add Note
            </Button>
            <Button
              id="clear-case-note"
              uswdsStyle={UswdsButtonStyle.Unstyled}
              onClick={clearCaseNoteForm}
              aria-label="Clear case note form data."
              ref={clearButtonRef}
            >
              Discard
            </Button>
          </div>
        </div>
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
      <Modal
        ref={archiveConfirmationModalRef}
        modalId={archiveConfirmationModalId}
        className="archive-confirmation-modal"
        heading="Remove note?"
        content="Would you like to remove this note? This action cannot be undone."
        actionButtonGroup={archiveConfirmationButtonGroup}
      ></Modal>
    </div>
  );
}
