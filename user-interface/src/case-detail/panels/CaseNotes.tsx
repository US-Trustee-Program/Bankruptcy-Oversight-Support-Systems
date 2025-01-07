import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import TextArea from '@/lib/components/uswds/TextArea';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { Api2 } from '@/lib/models/api2';
import { TextAreaRef } from '@/lib/type-declarations/input-fields';
import { formatDate } from '@/lib/utils/datetime';
import { CaseNote } from '@common/cams/cases';
import { useEffect, useRef, useState } from 'react';

export interface CaseNotesProps {
  caseId: string;
}

export default function CaseNotes(props: CaseNotesProps) {
  const [caseNotes, setCaseNotes] = useState<CaseNote[]>([]);
  const [areCaseNotesLoading, setAreCaseNotesLoading] = useState<boolean>(false);
  const [caseNoteInput, setCaseNoteInput] = useState<string>('');
  const textAreaRef = useRef<TextAreaRef>(null);
  const globalAlert = useGlobalAlert();

  const api = Api2;

  async function fetchCaseNotes() {
    setAreCaseNotesLoading(true);
    api
      .getCaseNotes(props.caseId)
      .then((response) => {
        setCaseNotes(response.data);
      })
      .catch(() => {
        globalAlert?.error('Could not retrieve case notes');
      })
      .finally(() => setAreCaseNotesLoading(false));
  }

  async function putCaseNote() {
    if (caseNoteInput.length > 0) {
      textAreaRef.current?.disable(true);
      api
        .postCaseNote(props.caseId, caseNoteInput)
        .then(() => {
          textAreaRef.current?.clearValue();
          fetchCaseNotes();
        })
        .catch(() => {
          globalAlert?.error('Could not insert case note');
        })
        .finally(() => {
          textAreaRef.current?.disable(false);
        });
    }
  }

  function showCaseNotes(note: CaseNote, idx: number) {
    return (
      <tr key={idx}>
        <td data-testid={`note-preview-${idx}`}>{note.content}</td>
        <td data-testid={`changed-by-${idx}`}>{note.updatedBy && <>{note.updatedBy.name}</>}</td>
        <td data-testid={`created-date-${idx}`}>
          <span className="text-no-wrap">{formatDate(note.updatedOn)}</span>
        </td>
      </tr>
    );
  }

  function renderCaseNotes() {
    return caseNotes.map((note, idx: number) => {
      return showCaseNotes(note, idx);
    });
  }

  useEffect(() => {
    fetchCaseNotes();
  }, []);

  return (
    <div className="case-notes">
      <div className="case-notes-title">
        <h3>Case Notes</h3>
        <TextArea
          id="note-creation"
          label="New Note"
          onChange={(event) => {
            setCaseNoteInput(event.target.value);
          }}
        />
        <Button
          id="button-submit-case-note"
          uswdsStyle={UswdsButtonStyle.Default}
          onClick={putCaseNote}
          aria-label="submit new case note."
        >
          Add Note
        </Button>
        {areCaseNotesLoading && <LoadingSpinner caption="Loading case notes..." />}
        {!areCaseNotesLoading && (
          <>
            {caseNotes.length < 1 && (
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
            {caseNotes.length > 0 && (
              <table data-testid="history-table" className="usa-table usa-table--borderless">
                <thead>
                  <tr>
                    <th>Note</th>
                    <th>Created On</th>
                    <th>Created By</th>
                  </tr>
                </thead>
                <tbody>{renderCaseNotes()}</tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
