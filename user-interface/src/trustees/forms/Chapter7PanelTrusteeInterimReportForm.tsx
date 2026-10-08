import './EditUpcomingKeyDates.scss';
import '@/lib/components/uswds/forms.scss';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
  calculateTirSubmission,
  calculateTirReview,
  validateCompletionPairPresence,
} from '@common/cams/trustee-upcoming-key-dates';
import { mergeKeyDatesInput, getFiscalYearOptions } from './keyDatesInput';
import {
  TirFrequency,
  ANNUAL_OPTIONS,
  SEMI_ANNUAL_OPTIONS,
  findPeriodKey,
} from './tirPeriodOptions';
import DatePicker from '@/lib/components/uswds/DatePicker';
import Select from '@/lib/components/uswds/Select';
import PairFieldGroup from './PairFieldGroup';
import { useKeyDatesFormShell } from './useKeyDatesFormShell';
import { KeyDatesFormShell } from './KeyDatesFormShell';

type TirCompletionStatus = 'COMPLETE' | 'INCOMPLETE';

type Chapter7PanelTrusteeInterimReportFormState = {
  tirFrequency: TirFrequency;
  tirPeriodKey: string;
  tirReviewPeriodStart: string;
  tirReviewPeriodEnd: string;
  tirSemiAnnualReviewPeriodStart: string;
  tirSemiAnnualReviewPeriodEnd: string;
  tirCompletionYear: number | '';
  tirCompletionStatus: TirCompletionStatus | '';
  pastTprSubmission: string;
};

const EMPTY_FORM: Chapter7PanelTrusteeInterimReportFormState = {
  tirFrequency: '',
  tirPeriodKey: '',
  tirReviewPeriodStart: '',
  tirReviewPeriodEnd: '',
  tirSemiAnnualReviewPeriodStart: '',
  tirSemiAnnualReviewPeriodEnd: '',
  tirCompletionYear: '',
  tirCompletionStatus: '',
  pastTprSubmission: '',
};

function calculateSubmissionAndReview(form: Chapter7PanelTrusteeInterimReportFormState) {
  let tirSubmission: string | null = null;
  let tirReview: string | null = null;
  let tirSemiAnnualSubmission: string | null = null;
  let tirSemiAnnualReview: string | null = null;

  if (form.tirReviewPeriodEnd) {
    tirSubmission = calculateTirSubmission(form.tirReviewPeriodEnd);
    tirReview = calculateTirReview(tirSubmission);
  }

  if (form.tirFrequency === 'SEMI_ANNUAL' && form.tirSemiAnnualReviewPeriodEnd) {
    tirSemiAnnualSubmission = calculateTirSubmission(form.tirSemiAnnualReviewPeriodEnd);
    tirSemiAnnualReview = calculateTirReview(tirSemiAnnualSubmission);
  }

  return { tirSubmission, tirReview, tirSemiAnnualSubmission, tirSemiAnnualReview };
}

export function buildTrusteeInterimReportKeyDatesInput(
  ids: { trusteeId: string; appointmentId: string },
  original: TrusteeUpcomingKeyDates | null,
  form: Chapter7PanelTrusteeInterimReportFormState,
): TrusteeUpcomingKeyDatesInput {
  const { tirSubmission, tirReview, tirSemiAnnualSubmission, tirSemiAnnualReview } =
    calculateSubmissionAndReview(form);

  return mergeKeyDatesInput(ids, original, {
    tirReviewPeriodStart: form.tirReviewPeriodStart || null,
    tirReviewPeriodEnd: form.tirReviewPeriodEnd || null,
    tirSubmission,
    tirReview,
    tirFrequency: form.tirFrequency || null,
    tirSemiAnnualReviewPeriodStart:
      form.tirFrequency === 'SEMI_ANNUAL' ? form.tirSemiAnnualReviewPeriodStart || null : null,
    tirSemiAnnualReviewPeriodEnd:
      form.tirFrequency === 'SEMI_ANNUAL' ? form.tirSemiAnnualReviewPeriodEnd || null : null,
    tirSemiAnnualSubmission,
    tirSemiAnnualReview,
    tirCompletionYear: form.tirCompletionYear !== '' ? form.tirCompletionYear : null,
    tirCompletionStatus: form.tirCompletionStatus || null,
    pastTprSubmission: form.pastTprSubmission || null,
  });
}

export default function Chapter7PanelTrusteeInterimReportForm() {
  const shell = useKeyDatesFormShell<Chapter7PanelTrusteeInterimReportFormState>({
    emptyForm: EMPTY_FORM,
    mapDataToForm: (data) => {
      const tirFrequency = data.tirFrequency ?? '';
      return {
        tirFrequency,
        tirPeriodKey: findPeriodKey(
          data.tirReviewPeriodStart,
          data.tirReviewPeriodEnd,
          tirFrequency,
        ),
        tirReviewPeriodStart: data.tirReviewPeriodStart ?? '',
        tirReviewPeriodEnd: data.tirReviewPeriodEnd ?? '',
        tirSemiAnnualReviewPeriodStart: data.tirSemiAnnualReviewPeriodStart ?? '',
        tirSemiAnnualReviewPeriodEnd: data.tirSemiAnnualReviewPeriodEnd ?? '',
        tirCompletionYear: data.tirCompletionYear ?? '',
        tirCompletionStatus: data.tirCompletionStatus ?? '',
        pastTprSubmission: data.pastTprSubmission ?? '',
      };
    },
    buildInput: buildTrusteeInterimReportKeyDatesInput,
    errorLabel: 'Trustee Interim Report key dates',
  });

  function handleFrequencyChange(ev: React.ChangeEvent<HTMLSelectElement>) {
    const freq = ev.target.value as TirFrequency;
    shell.setForm((prev) => ({
      ...prev,
      tirFrequency: freq,
      tirPeriodKey: '',
      tirReviewPeriodStart: '',
      tirReviewPeriodEnd: '',
      tirSemiAnnualReviewPeriodStart: '',
      tirSemiAnnualReviewPeriodEnd: '',
    }));
  }

  function handlePeriodChange(ev: React.ChangeEvent<HTMLSelectElement>) {
    const key = ev.target.value;
    if (!key) {
      shell.setForm((prev) => ({
        ...prev,
        tirPeriodKey: '',
        tirReviewPeriodStart: '',
        tirReviewPeriodEnd: '',
        tirSemiAnnualReviewPeriodStart: '',
        tirSemiAnnualReviewPeriodEnd: '',
      }));
      return;
    }
    const allOptions =
      shell.form.tirFrequency === 'ANNUAL'
        ? ANNUAL_OPTIONS
        : shell.form.tirFrequency === 'SEMI_ANNUAL'
          ? SEMI_ANNUAL_OPTIONS
          : [];
    // The DOM's <option> elements are generated from allOptions, so key always
    // resolves to one of them -- there is no "not found" state to guard against.
    const option = allOptions.find((o) => o.key === key)!;
    shell.setForm((prev) => ({
      ...prev,
      tirPeriodKey: key,
      tirReviewPeriodStart: option.start,
      tirReviewPeriodEnd: option.end,
      tirSemiAnnualReviewPeriodStart: option.start2 ?? '',
      tirSemiAnnualReviewPeriodEnd: option.end2 ?? '',
    }));
  }

  const periodOptions = shell.form.tirFrequency === 'ANNUAL' ? ANNUAL_OPTIONS : SEMI_ANNUAL_OPTIONS;
  const tirPeriodPairError = validateCompletionPairPresence(
    shell.form.tirFrequency,
    shell.form.tirPeriodKey,
    'Trustee Interim Report (TIR) Period',
    { first: 'Frequency', second: 'Period' },
  );
  const completionPairError = validateCompletionPairPresence(
    shell.form.tirCompletionYear,
    shell.form.tirCompletionStatus,
    'Trustee Interim Report Completion Status',
  );

  return (
    <KeyDatesFormShell
      loadingId="edit-chapter7-panel-tir-loading"
      forbiddenMessage="You do not have permission to manage Trustee Interim Report Key Dates"
      containerTestId="edit-chapter7-panel-tir"
      title="Edit Trustee Interim Report (TIR) Key Dates"
      idBase="chapter7-panel-tir"
      withTestIds
      isLoading={shell.isLoading}
      canManage={shell.canManage}
      isSaving={shell.isSaving}
      isSaveDisabled={
        !!tirPeriodPairError ||
        !!completionPairError ||
        shell.hasErrorAmong(['past-tpr-submission'])
      }
      onSave={shell.handleSave}
      onCancel={shell.handleCancel}
    >
      <PairFieldGroup
        idPrefix="tir-period-pair"
        groupClassName="tir-period-group"
        rowClassName="tir-period-group__row"
        title="TIR Period"
        error={tirPeriodPairError}
      >
        {({ hasError, ariaDescribedBy }) => (
          <>
            <Select
              id="tir-frequency"
              label="Frequency"
              compactLabel
              hasError={hasError}
              ariaDescribedBy={ariaDescribedBy}
              placeholder="- Select -"
              options={[
                { value: 'ANNUAL', label: 'Annual' },
                { value: 'SEMI_ANNUAL', label: 'Semi-Annual' },
              ]}
              value={shell.form.tirFrequency}
              onChange={handleFrequencyChange}
            />
            <Select
              id="tir-period"
              label="Period"
              compactLabel
              hasError={hasError}
              ariaDescribedBy={ariaDescribedBy}
              placeholder="- Select -"
              options={periodOptions.map((o) => ({ value: o.key, label: o.label }))}
              value={shell.form.tirPeriodKey}
              onChange={handlePeriodChange}
              disabled={!shell.form.tirFrequency}
            />
          </>
        )}
      </PairFieldGroup>

      <DatePicker
        id="past-tpr-submission"
        label="Last TIR Letter"
        value={shell.form.pastTprSubmission}
        onChange={(e) => shell.setForm((prev) => ({ ...prev, pastTprSubmission: e.target.value }))}
        onValidationChange={(hasError) => shell.registerFieldError('past-tpr-submission', hasError)}
        disableMax
      />

      <PairFieldGroup
        idPrefix="tir-completion-status"
        groupClassName="exam-audit-group"
        rowClassName="exam-audit-group__row"
        title="TIR Completion Status for Year"
        error={completionPairError}
      >
        {({ hasError, ariaDescribedBy }) => (
          <>
            <Select
              id="tir-completion-status-year"
              label="Year"
              compactLabel
              hasError={hasError}
              ariaDescribedBy={ariaDescribedBy}
              placeholder="- Select -"
              options={getFiscalYearOptions().map((year) => ({
                value: String(year),
                label: String(year),
              }))}
              value={
                shell.form.tirCompletionYear === '' ? '' : String(shell.form.tirCompletionYear)
              }
              onChange={(e) => {
                const val = e.target.value;
                shell.setForm((prev) => ({
                  ...prev,
                  tirCompletionYear: val ? Number(val) : '',
                }));
              }}
            />
            <Select
              id="tir-completion-status-status"
              label="Status"
              compactLabel
              hasError={hasError}
              ariaDescribedBy={ariaDescribedBy}
              placeholder="- Select -"
              options={[
                { value: 'COMPLETE', label: 'Complete' },
                { value: 'INCOMPLETE', label: 'Incomplete' },
              ]}
              value={shell.form.tirCompletionStatus}
              onChange={(e) => {
                shell.setForm((prev) => ({
                  ...prev,
                  tirCompletionStatus: e.target.value as TirCompletionStatus | '',
                }));
              }}
            />
          </>
        )}
      </PairFieldGroup>
    </KeyDatesFormShell>
  );
}
