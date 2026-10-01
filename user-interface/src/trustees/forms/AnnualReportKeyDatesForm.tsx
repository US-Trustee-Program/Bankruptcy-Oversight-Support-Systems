import './EditUpcomingKeyDates.scss';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { mergeKeyDatesInput } from './keyDatesInput';
import CompletionStatusFields, { CompletionStatusValue } from './CompletionStatusFields';
import { validateCompletionPairPresence } from '@common/cams/trustee-upcoming-key-dates';
import { useKeyDatesFormShell } from './useKeyDatesFormShell';
import { KeyDatesFormShell } from './KeyDatesFormShell';

const EMPTY_COMPLETION: CompletionStatusValue = { year: '', status: '' };

function mapDataToForm(data: TrusteeUpcomingKeyDates): CompletionStatusValue {
  return {
    year: data.annualReportCompletionYear ?? '',
    status: data.annualReportCompletionStatus ?? '',
  };
}

export default function AnnualReportKeyDatesForm() {
  const shell = useKeyDatesFormShell<CompletionStatusValue>({
    emptyForm: EMPTY_COMPLETION,
    mapDataToForm,
    buildInput: (ids, original, completion) =>
      mergeKeyDatesInput(ids, original, {
        annualReportCompletionYear: completion.year === '' ? null : completion.year,
        annualReportCompletionStatus: completion.status === '' ? null : completion.status,
      }),
    errorLabel: 'annual report key dates',
  });

  // No whole-document validation here. The field this form owns is checked
  // inline, and the API validates the rest; the four Chapter 7 Panel forms
  // work the same way. Validating the merged document client-side blocked
  // saves on fields this form cannot display, with no way to fix them.
  const completionPairError = validateCompletionPairPresence(
    shell.form.year,
    shell.form.status,
    'Annual Report Completion Status',
  );

  return (
    <KeyDatesFormShell
      loadingId="edit-annual-report-key-dates-loading"
      forbiddenMessage="You do not have permission to manage Trustee Annual Report Key Dates"
      containerTestId="edit-annual-report-key-dates"
      title="Edit Annual Report"
      idBase="annual-report-key-dates"
      withTestIds
      isLoading={shell.isLoading}
      canManage={shell.canManage}
      isSaving={shell.isSaving}
      isSaveDisabled={!!completionPairError}
      onSave={shell.handleSave}
      onCancel={shell.handleCancel}
    >
      <p>
        Annual Report Submission and Annual Report Due to OO are fixed for Chapter 12 and 13 Case by
        Case appointments and cannot be edited.
      </p>
      <CompletionStatusFields
        idPrefix="annual-report-completion"
        legend="Annual Report Completion"
        value={shell.form}
        onChange={shell.setForm}
        errorLabel="Annual Report Completion Status"
      />
    </KeyDatesFormShell>
  );
}
