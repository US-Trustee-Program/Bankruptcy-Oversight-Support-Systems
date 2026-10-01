import './EditUpcomingKeyDates.scss';
import '@/lib/components/uswds/forms.scss';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
  validateCompletionPairPresence,
} from '@common/cams/trustee-upcoming-key-dates';
import { mergeKeyDatesInput, buildYearOptions, getFiscalYearOptions } from './keyDatesInput';
import DatePicker from '@/lib/components/uswds/DatePicker';
import Select from '@/lib/components/uswds/Select';
import PairFieldGroup from './PairFieldGroup';
import CompletionStatusYearSelect from './CompletionStatusYearSelect';
import { useKeyDatesFormShell } from './useKeyDatesFormShell';
import { KeyDatesFormShell } from './KeyDatesFormShell';

type AuditCompletionStatus = 'CLOSED' | 'NOT_CLOSED';

const AUDIT_COMPLETION_STATUS_OPTIONS = [
  { value: 'CLOSED', label: 'Closed' },
  { value: 'NOT_CLOSED', label: 'Not Closed' },
] as const;

type Chapter7PanelAuditFieldExamFormState = {
  upcomingExamOrAuditYear: number | '';
  upcomingExamOrAuditType: 'Field Exam' | 'Audit' | '';
  pastAudit: string;
  lastAuditFiscalYear: number | '';
  pastFieldExam: string;
  auditCompletionYear: number | '';
  auditCompletionStatus: AuditCompletionStatus | '';
};

const EMPTY_FORM: Chapter7PanelAuditFieldExamFormState = {
  upcomingExamOrAuditYear: '',
  upcomingExamOrAuditType: '',
  pastAudit: '',
  lastAuditFiscalYear: '',
  pastFieldExam: '',
  auditCompletionYear: '',
  auditCompletionStatus: '',
};

export function buildAuditFieldExamKeyDatesInput(
  ids: { trusteeId: string; appointmentId: string },
  original: TrusteeUpcomingKeyDates | null,
  form: Chapter7PanelAuditFieldExamFormState,
): TrusteeUpcomingKeyDatesInput {
  return mergeKeyDatesInput(ids, original, {
    pastFieldExam: form.pastFieldExam || null,
    pastAudit: form.pastAudit || null,
    upcomingExamOrAuditYear:
      form.upcomingExamOrAuditYear !== '' ? form.upcomingExamOrAuditYear : null,
    upcomingExamOrAuditType: form.upcomingExamOrAuditType || null,
    lastAuditFiscalYear: form.lastAuditFiscalYear !== '' ? form.lastAuditFiscalYear : null,
    auditCompletionYear: form.auditCompletionYear !== '' ? form.auditCompletionYear : null,
    auditCompletionStatus: form.auditCompletionStatus || null,
  });
}

export default function Chapter7PanelAuditFieldExamForm() {
  const upcomingYearOptions = buildYearOptions('forward', 11);

  const shell = useKeyDatesFormShell<Chapter7PanelAuditFieldExamFormState>({
    emptyForm: EMPTY_FORM,
    mapDataToForm: (data) => ({
      upcomingExamOrAuditYear: data.upcomingExamOrAuditYear ?? '',
      upcomingExamOrAuditType: data.upcomingExamOrAuditType ?? '',
      pastAudit: data.pastAudit ?? '',
      lastAuditFiscalYear: data.lastAuditFiscalYear ?? '',
      pastFieldExam: data.pastFieldExam ?? '',
      auditCompletionYear: data.auditCompletionYear ?? '',
      auditCompletionStatus: data.auditCompletionStatus ?? '',
    }),
    buildInput: buildAuditFieldExamKeyDatesInput,
    errorLabel: 'Audit/Field Exam key dates',
  });

  function handleDateChange(field: 'pastAudit' | 'pastFieldExam') {
    return (ev: React.ChangeEvent<HTMLInputElement>) => {
      shell.setForm((prev) => ({ ...prev, [field]: ev.target.value }));
    };
  }

  const hasAnyDateError = shell.hasErrorAmong(['past-audit', 'past-field-exam']);
  const examOrAuditPairError = validateCompletionPairPresence(
    shell.form.upcomingExamOrAuditYear,
    shell.form.upcomingExamOrAuditType,
    'Field Exam or Audit',
    { first: 'Year', second: 'Type' },
  );
  const completionPairError = validateCompletionPairPresence(
    shell.form.auditCompletionYear,
    shell.form.auditCompletionStatus,
    'Field Exam/Audit Completion Status',
  );

  return (
    <KeyDatesFormShell
      loadingId="edit-chapter7-panel-audit-field-exam-loading"
      forbiddenMessage="You do not have permission to manage Trustee Audit/Field Exam Key Dates"
      containerTestId="edit-chapter7-panel-audit-field-exam"
      title="Edit Audit/Field Exam Key Dates"
      idBase="chapter7-panel-audit-field-exam"
      withTestIds
      isLoading={shell.isLoading}
      canManage={shell.canManage}
      isSaving={shell.isSaving}
      isSaveDisabled={hasAnyDateError || !!examOrAuditPairError || !!completionPairError}
      onSave={shell.handleSave}
      onCancel={shell.handleCancel}
    >
      <PairFieldGroup
        idPrefix="exam-audit-pair"
        groupClassName="exam-audit-group"
        rowClassName="exam-audit-group__row"
        title="Field Exam or Audit"
        error={examOrAuditPairError}
      >
        {({ hasError, ariaDescribedBy }) => (
          <>
            <Select
              id="upcoming-exam-audit-year"
              label="Year"
              compactLabel
              hasError={hasError}
              ariaDescribedBy={ariaDescribedBy}
              placeholder="- Select -"
              options={upcomingYearOptions.map((y) => ({ value: String(y), label: String(y) }))}
              value={
                shell.form.upcomingExamOrAuditYear === ''
                  ? ''
                  : String(shell.form.upcomingExamOrAuditYear)
              }
              onChange={(e) => {
                const val = e.target.value;
                shell.setForm((prev) => ({
                  ...prev,
                  upcomingExamOrAuditYear: val ? Number(val) : '',
                }));
              }}
            />
            <Select
              id="upcoming-exam-audit-type"
              label="Type"
              compactLabel
              hasError={hasError}
              ariaDescribedBy={ariaDescribedBy}
              placeholder="- Select -"
              options={[
                { value: 'Field Exam', label: 'Field Exam' },
                { value: 'Audit', label: 'Audit' },
              ]}
              value={shell.form.upcomingExamOrAuditType}
              onChange={(e) => {
                shell.setForm((prev) => ({
                  ...prev,
                  upcomingExamOrAuditType: e.target.value as 'Field Exam' | 'Audit' | '',
                }));
              }}
            />
          </>
        )}
      </PairFieldGroup>

      <DatePicker
        id="past-audit"
        label="Audit Report Date"
        value={shell.form.pastAudit}
        onChange={handleDateChange('pastAudit')}
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

      <DatePicker
        id="past-field-exam"
        label="Field Exam Report Date"
        value={shell.form.pastFieldExam}
        onChange={handleDateChange('pastFieldExam')}
        onValidationChange={(hasError) => shell.registerFieldError('past-field-exam', hasError)}
        disableMax
      />

      <CompletionStatusYearSelect
        idPrefix="audit-completion-status"
        groupClassName="exam-audit-group"
        rowClassName="exam-audit-group__row"
        title="Field Exam/Audit Completion Status for Year"
        errorLabel="Field Exam/Audit Completion Status"
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
