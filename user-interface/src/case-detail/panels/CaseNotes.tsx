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
import { useEffect, useRef, RefObject } from 'react';
import { sanitizeText } from '@/lib/utils/sanitize-text';
import { HttpResponse } from '@okta/okta-auth-js';
import { HttpStatusCodes } from '../../../../common/src/api/http-status-codes';
import Input from '@/lib/components/uswds/Input';
import { AlertOptions } from './CaseDetailCourtDocket';
import { handleHighlight } from '@/lib/utils/highlight-api';
import LocalFormCache from '@/lib/utils/local-form-cache';

function buildCaseNoteFormKey(caseId: string) {
  return `case-notes-${caseId}`;
}

export interface CaseNotesProps {
  caseId: string;
  areCaseNotesLoading?: boolean;
  hasCaseNotes: boolean;
  caseNotes?: CaseNote[];
  alertOptions?: AlertOptions;
  onNoteCreation: () => void;
  searchString: string;
}

export default function CaseNotes(props: CaseNotesProps) {
  const { caseId, caseNotes, areCaseNotesLoading, searchString } = props;
  const titleInputRef = useRef<TextAreaRef>(null);
  const contentInputRef = useRef<TextAreaRef>(null);
  const submitButtonRef = useRef<ButtonRef>(null);
  const clearButtonRef = useRef<ButtonRef>(null);
  const globalAlert = useGlobalAlert();

  const api = Api2;

  const MINIMUM_SEARCH_CHARACTERS = 3;
  const formKey = buildCaseNoteFormKey(caseId);

  function getInputValue(inputRef: RefObject<TextAreaRef>) {
    return inputRef.current?.getValue() ?? '';
  }

  function handleTitleChange(event: React.ChangeEvent<HTMLInputElement>) {
    saveFormData({
      caseId: props.caseId,
      title: event.target.value,
      content: getInputValue(contentInputRef), // TODO: need to test
    });
  }

  function handleContentChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    saveFormData({
      caseId: props.caseId,
      title: getInputValue(titleInputRef), // TODO: need to test
      content: event.target.value,
    });
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
      const caseNoteInput: CaseNoteInput = {
        caseId: props.caseId,
        title: formData.title,
        content: formData.content,
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
    } else {
      globalAlert?.error('All case note input fields are required to submit a note.');
    }
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
      </li>
    );
  }

  function renderCaseNotes() {
    return caseNotes?.map((note, idx: number) => {
      return showCaseNotes(note, idx);
    });
  }

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
      (formData.title?.length > 0 || formData.content?.length > 0) // TODO: need to test
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
    </div>
  );
}
