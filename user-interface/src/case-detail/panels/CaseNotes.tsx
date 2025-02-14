import './CaseNotes.scss';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { AlertRefType, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
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
import LocalStorage from '@/lib/utils/local-storage';

const initialFormData: CaseNoteInput = {
  caseId: '',
  title: '',
  content: '',
};

const formKey = 'CamsCaseNote';

export interface CaseNotesProps {
  caseId: string;
  areCaseNotesLoading?: boolean;
  hasCaseNotes: boolean;
  caseNotes?: CaseNote[];
  alertOptions?: AlertOptions;
  onNoteCreation: () => void;
  searchString: string;
}
//TODO: Do we want a button for clear form?
export default function CaseNotes(props: CaseNotesProps) {
  const { caseNotes, areCaseNotesLoading, searchString } = props;
  const [formData, setFormData] = useState<CaseNoteInput>(() => {
    const note = LocalStorage.getForm(formKey) as CaseNoteInput;
    if (note?.caseId === props.caseId) {
      return note;
    } else {
      return initialFormData;
    }
  });
  const caseNoteDraftAlertRef = useRef<AlertRefType>(null);
  const titleInputRef = useRef<TextAreaRef>(null);
  const contentInputRef = useRef<TextAreaRef>(null);
  const buttonRef = useRef<ButtonRef>(null);
  const globalAlert = useGlobalAlert();

  const api = Api2;

  const MINIMUM_SEARCH_CHARACTERS = 3;

  function handleTitleChange(event: React.ChangeEvent<HTMLInputElement>) {
    saveFormData({
      caseId: props.caseId,
      title: event.target.value,
      content: contentInputRef.current?.getValue() ?? '',
    });
  }

  function handleContentChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    saveFormData({
      caseId: props.caseId,
      title: titleInputRef.current?.getValue() ?? '',
      content: event.target.value,
    });
  }

  function saveFormData(data: CaseNoteInput) {
    setFormData((previousValue) => ({ ...previousValue, ...data }));
  }

  function clearCaseNoteForm() {
    titleInputRef.current?.clearValue();
    contentInputRef.current?.clearValue();
    LocalStorage.clearForm(formKey);
  }

  async function putCaseNote() {
    if (formData.title.length > 0 && formData.content.length > 0) {
      titleInputRef.current?.disable(true);
      contentInputRef.current?.disable(true);
      buttonRef.current?.disableButton(true);
      const caseNoteInput: CaseNoteInput = {
        caseId: props.caseId,
        title: formData.title,
        content: formData.content,
      };
      api
        .postCaseNote(caseNoteInput)
        .then(() => {
          clearCaseNoteForm();
          if (props.onNoteCreation) props.onNoteCreation();
          // only clear the form on success
        })
        .catch((e: HttpResponse) => {
          if (e.status !== HttpStatusCodes.FORBIDDEN) {
            globalAlert?.error('Could not insert case note.');
          }
        })
        .finally(() => {
          titleInputRef.current?.disable(false);
          contentInputRef.current?.disable(false);
          buttonRef.current?.disableButton(false);
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
    const timeout = setTimeout(() => {
      if (formData.title.length > 0 || formData.content.length > 0) {
        LocalStorage.saveForm(formKey, formData);
        caseNoteDraftAlertRef.current?.show();
      } else {
        caseNoteDraftAlertRef.current?.hide();
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [formData]);

  useEffect(() => {
    if (formData.caseId === props.caseId) {
      titleInputRef.current?.setValue(formData.title);
      contentInputRef.current?.setValue(formData.content);
    }
  }, []);

  return (
    <div className="case-notes-panel">
      <div className="measure-6">
        <Alert
          type={UswdsAlertStyle.Info}
          title="Unsaved Draft Note"
          id="case-note-draft"
          inline={true}
          slim={true}
          ref={caseNoteDraftAlertRef}
        >
          Note stored as a draft. Click “Add Note” to save the draft. Unsaved drafts may be lost.
        </Alert>
      </div>
      <div className="case-notes-title">
        <h3>Case Notes</h3>
        <div className="case-notes-form-container">
          <Input
            id="case-note-title-input"
            label="Note title"
            includeClearButton={true}
            onChange={handleTitleChange}
            value={formData.title}
            ref={titleInputRef}
          />
          <TextArea
            id="note-content"
            label="Note Text"
            onChange={handleContentChange}
            value={formData.content}
            ref={contentInputRef}
          />
          <Button
            id="submit-case-note"
            uswdsStyle={UswdsButtonStyle.Default}
            onClick={putCaseNote}
            aria-label="Add case note."
            ref={buttonRef}
          >
            Add Note
          </Button>
          <Button
            id="clear-case-note"
            uswdsStyle={UswdsButtonStyle.Unstyled}
            onClick={clearCaseNoteForm}
            aria-label="Clear case note form data."
            ref={buttonRef}
          >
            Clear
          </Button>
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
