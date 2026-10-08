import './EditUpcomingKeyDates.scss';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
  validateCompletionPairPresence,
} from '@common/cams/trustee-upcoming-key-dates';
import { mergeKeyDatesInput, getFiscalYearOptions } from './keyDatesInput';
import DatePicker from '@/lib/components/uswds/DatePicker';
import Select from '@/lib/components/uswds/Select';
import CompletionStatusYearSelect from './CompletionStatusYearSelect';
import { useKeyDatesFormShell } from './useKeyDatesFormShell';
import { KeyDatesFormShell } from './KeyDatesFormShell';

const AUDIT_COMPLETION_STATUS_OPTIONS = [
  { value: 'CLOSED', label: 'Closed' },
  { value: 'NOT_CLOSED', label: 'Not Closed' },
] as const;

type AuditCompletionStatus = 'CLOSED' | 'NOT_CLOSED';

type Chapter12StandingAuditFormState = {
  pastAudit: string;
  lastAuditFiscalYear: number | '';
  auditCompletionYear: number | '';
  auditCompletionStatus: AuditCompletionStatus | '';
};

const EMPTY_FORM: Chapter12StandingAuditFormState = {
  pastAudit: '',
  lastAuditFiscalYear: '',
  auditCompletionYear: '',
  auditCompletionStatus: '',
};

export function buildAuditKeyDatesInput(
  ids: { trusteeId: string; appointmentId: string },
  original: TrusteeUpcomingKeyDates | null,
  form: Chapter12StandingAuditFormState,
): TrusteeUpcomingKeyDatesInput {
  return mergeKeyDatesInput(ids, original, {
    pastAudit: form.pastAudit || null,
    lastAuditFiscalYear: form.lastAuditFiscalYear !== '' ? form.lastAuditFiscalYear : null,
    auditCompletionYear: form.auditCompletionYear !== '' ? form.auditCompletionYear : null,
    auditCompletionStatus: form.auditCompletionStatus || null,
  });
}

export default function Chapter12StandingAuditForm() {
  const shell = useKeyDatesFormShell<Chapter12StandingAuditFormState>({
    emptyForm: EMPTY_FORM,
    mapDataToForm: (data) => ({
      pastAudit: data.pastAudit ?? '',
      lastAuditFiscalYear: data.lastAuditFiscalYear ?? '',
      auditCompletionYear: data.auditCompletionYear ?? '',
      auditCompletionStatus: data.auditCompletionStatus ?? '',
    }),
    buildInput: buildAuditKeyDatesInput,
    errorLabel: 'Audit key dates',
  });

  function handleDateChange(ev: React.ChangeEvent<HTMLInputElement>) {
    shell.setForm((prev) => ({ ...prev, pastAudit: ev.target.value }));
  }

  const hasAnyDateError = shell.hasErrorAmong(['past-audit']);
  const completionPairError = validateCompletionPairPresence(
    shell.form.auditCompletionYear,
    shell.form.auditCompletionStatus,
    'Audit Completion Status',
  );

  return (
    <KeyDatesFormShell
      loadingId="edit-chapter12-standing-audit-loading"
      forbiddenMessage="You do not have permission to manage Trustee Audit Key Dates"
      containerTestId="edit-chapter12-standing-audit"
      title="Edit Audit Key Dates"
      idBase="chapter12-standing-audit"
      withTestIds
      isLoading={shell.isLoading}
      canManage={shell.canManage}
      isSaving={shell.isSaving}
      isSaveDisabled={shell.loadFailed || hasAnyDateError || !!completionPairError}
      onSave={shell.handleSave}
      onCancel={shell.handleCancel}
    >
      <DatePicker
        id="past-audit"
        label="Audit Report Date"
        value={shell.form.pastAudit}
        onChange={handleDateChange}
        onValidationChange={(hasError) => shell.registerFieldError('past-audit', hasError)}
        disableMax
      />

      <Select
        id="last-audit-fiscal-year"
        label="Last Audit's Fiscal Year"
        ariaDescription="The fiscal year of the TIR data audited"
        placeholder="- Select -"
        options={getFiscalYearOptions().map((year) => ({
          value: String(year),
          label: String(year),
        }))}
        value={shell.form.lastAuditFiscalYear === '' ? '' : String(shell.form.lastAuditFiscalYear)}
        onChange={(ev) => {
          const val = ev.target.value;
          shell.setForm((prev) => ({ ...prev, lastAuditFiscalYear: val ? Number(val) : '' }));
        }}
      />

      <CompletionStatusYearSelect
        idPrefix="audit-completion-status"
        groupClassName="exam-audit-group"
        rowClassName="exam-audit-group__row"
        title="Audit Completion Status for Year"
        errorLabel="Audit Completion Status"
        yearOptions={getFiscalYearOptions()}
        statusOptions={AUDIT_COMPLETION_STATUS_OPTIONS}
        year={shell.form.auditCompletionYear}
        status={shell.form.auditCompletionStatus}
        onYearChange={(auditCompletionYear) =>
          shell.setForm((prev) => ({ ...prev, auditCompletionYear }))
        }
        onStatusChange={(auditCompletionStatus) =>
          shell.setForm((prev) => ({ ...prev, auditCompletionStatus }))
        }
      />
    </KeyDatesFormShell>
  );
}
