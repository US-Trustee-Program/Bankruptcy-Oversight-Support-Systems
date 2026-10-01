import './Chapter13StandingAuditForm.scss';
import {
  CompletionStatus,
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
} from '@common/cams/trustee-upcoming-key-dates';
import DatePicker from '@/lib/components/uswds/DatePicker';
import { buildKeyDatesInputFromOriginal, getCompletionYearOptions } from './keyDatesInputDefaults';
import CompletionStatusYearSelect from './CompletionStatusYearSelect';
import { useKeyDatesFormShell } from './useKeyDatesFormShell';
import { KeyDatesFormShell } from './KeyDatesFormShell';

const CH13_AUDIT_STATUS_OPTIONS = [
  { value: 'COMPLETE', label: 'Closed' },
  { value: 'INCOMPLETE', label: 'Not Closed' },
] as const;

type FormState = {
  pastAudit: string;
  ch13AuditCompletionYear: number | '';
  ch13AuditCompletionStatus: CompletionStatus | '';
};

const EMPTY_FORM: FormState = {
  pastAudit: '',
  ch13AuditCompletionYear: '',
  ch13AuditCompletionStatus: '',
};

function buildFormStateFromData(data: TrusteeUpcomingKeyDates): FormState {
  return {
    pastAudit: data.pastAudit ?? '',
    ch13AuditCompletionYear: data.ch13AuditCompletionYear ?? '',
    ch13AuditCompletionStatus: data.ch13AuditCompletionStatus ?? '',
  };
}

function buildInput(
  ids: { trusteeId: string; appointmentId: string },
  original: TrusteeUpcomingKeyDates | null,
  form: FormState,
): TrusteeUpcomingKeyDatesInput {
  return {
    ...buildKeyDatesInputFromOriginal(ids.trusteeId, ids.appointmentId, original),
    pastAudit: form.pastAudit || null,
    ch13AuditCompletionYear: form.ch13AuditCompletionYear || null,
    ch13AuditCompletionStatus: form.ch13AuditCompletionStatus || null,
  };
}

export default function Chapter13StandingAuditForm() {
  const shell = useKeyDatesFormShell<FormState>({
    emptyForm: EMPTY_FORM,
    mapDataToForm: buildFormStateFromData,
    buildInput,
    errorLabel: 'Audit key dates',
  });

  const isCompletionPairIncomplete =
    (!!shell.form.ch13AuditCompletionYear && !shell.form.ch13AuditCompletionStatus) ||
    (!shell.form.ch13AuditCompletionYear && !!shell.form.ch13AuditCompletionStatus);

  const isSaveDisabled =
    shell.loadFailed || shell.hasErrorAmong(['past-audit']) || isCompletionPairIncomplete;

  return (
    <KeyDatesFormShell
      loadingId="edit-chapter13-standing-audit-key-dates-loading"
      forbiddenMessage="You do not have permission to manage Trustee Upcoming Key Dates"
      containerClassName="edit-chapter13-standing-audit-key-dates"
      containerTestId="edit-chapter13-standing-audit-key-dates"
      title="Edit Audit Key Dates"
      idBase="chapter13-standing-audit-key-dates"
      isLoading={shell.isLoading}
      canManage={shell.canManage}
      isSaving={shell.isSaving}
      isSaveDisabled={isSaveDisabled}
      onSave={shell.handleSave}
      onCancel={shell.handleCancel}
    >
      <DatePicker
        id="past-audit"
        label="Audit Report Date"
        value={shell.form.pastAudit}
        disableMax
        onChange={(e) => shell.setForm((prev) => ({ ...prev, pastAudit: e.target.value }))}
        onValidationChange={(hasError) => shell.registerFieldError('past-audit', hasError)}
      />
      <CompletionStatusYearSelect
        idPrefix="audit-completion"
        title="Audit Completion Status for Year"
        errorLabel="Audit Completion Status"
        yearOptions={getCompletionYearOptions()}
        statusOptions={CH13_AUDIT_STATUS_OPTIONS}
        year={shell.form.ch13AuditCompletionYear}
        status={shell.form.ch13AuditCompletionStatus}
        onYearChange={(ch13AuditCompletionYear) =>
          shell.setForm((prev) => ({ ...prev, ch13AuditCompletionYear }))
        }
        onStatusChange={(ch13AuditCompletionStatus) =>
          shell.setForm((prev) => ({ ...prev, ch13AuditCompletionStatus }))
        }
      />
    </KeyDatesFormShell>
  );
}
