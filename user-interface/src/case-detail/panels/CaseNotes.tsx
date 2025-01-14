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
import { useRef, useState } from 'react';
import { sanitizeText } from '@/lib/utils/sanitize-text';
import { HttpResponse } from '@okta/okta-auth-js';
import { HttpStatusCodes } from '../../../../common/src/api/http-status-codes';
import Input from '@/lib/components/uswds/Input';
import { AlertOptions } from './CaseDetailCourtDocket';

export interface CaseNotesProps {
  caseId: string;
  areCaseNotesLoading?: boolean;
  hasCaseNotes: boolean;
  caseNotes?: CaseNote[];
  alertOptions?: AlertOptions;
  onNoteCreation: () => void;
}

export default function CaseNotes(props: CaseNotesProps) {
  const { caseNotes, areCaseNotesLoading } = props;
  const [caseNoteContentInput, setCaseNoteContentInput] = useState<string>('');
  const [caseNoteTitleInput, setCaseNoteTitleInput] = useState<string>('');
  const titleInputRef = useRef<TextAreaRef>(null);
  const contentInputRef = useRef<TextAreaRef>(null);
  const buttonRef = useRef<ButtonRef>(null);
  const globalAlert = useGlobalAlert();

  const api = Api2;

  async function putCaseNote() {
    if (caseNoteContentInput.length > 0 && caseNoteTitleInput.length > 0) {
      titleInputRef.current?.disable(true);
      contentInputRef.current?.disable(true);
      buttonRef.current?.disableButton(true);
      const caseNoteInput: CaseNoteInput = {
        caseId: props.caseId,
        title: caseNoteTitleInput,
        content: caseNoteContentInput,
      };
      api
        .postCaseNote(caseNoteInput)
        .then(() => {
          titleInputRef.current?.clearValue();
          contentInputRef.current?.clearValue();
          if (props.onNoteCreation) props.onNoteCreation();
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
      globalAlert?.error('Case Note missing required information.');
    }
  }

  function showCaseNotes(note: CaseNote, idx: number) {
    const purifiedCaseNote = sanitizeText(note.content);
    const purifiedCaseTitle = sanitizeText(note.title);
    return (
      <li className="case-note grid-container" key={idx} data-testid={`case-note-${idx}`}>
        <div className="grid-row case-note-title-and-date">
          <div className="grid-col-8">
            <h4
              className="case-note-header usa-tooltip"
              data-testid={`case-note-${idx}-header`}
              title={purifiedCaseTitle}
            >
              {purifiedCaseTitle}
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
              {purifiedCaseNote}
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

  return (
    <div className="case-notes-panel">
      <div className="case-notes-title">
        <h3>Case Notes</h3>
        <div className="case-notes-form-container">
          <Input
            id="case-note-title-input"
            label="Note title"
            includeClearButton={true}
            onChange={(event) => {
              setCaseNoteTitleInput(event.target.value);
            }}
            ref={titleInputRef}
          />
          <TextArea
            id="note-content"
            label="Note Text"
            onChange={(event) => {
              setCaseNoteContentInput(event.target.value);
            }}
            ref={contentInputRef}
          />
          <Button
            id="submit-case-note"
            uswdsStyle={UswdsButtonStyle.Default}
            onClick={putCaseNote}
            aria-label="submit new case note."
            ref={buttonRef}
          >
            Add Note
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
