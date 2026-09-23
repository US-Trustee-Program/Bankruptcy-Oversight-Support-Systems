import './EditUpcomingKeyDates.scss';
import '@/lib/components/uswds/forms.scss';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
  calculateTirSubmission,
  calculateTirReview,
  validateCompletionPairPresence,
} from '@common/cams/trustee-upcoming-key-dates';
import { mergeKeyDatesInput, FISCAL_YEAR_OPTIONS } from './chapter7PanelKeyDatesInput';
import {
  TirFrequency,
  ANNUAL_OPTIONS,
  SEMI_ANNUAL_OPTIONS,
  findPeriodKey,
} from './tirPeriodOptions';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import DatePicker from '@/lib/components/uswds/DatePicker';
import Select from '@/lib/components/uswds/Select';
import useDateFieldErrors from '@/lib/hooks/UseDateFieldErrors';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { Stop } from '@/lib/components/Stop';

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
  const { trusteeId, appointmentId } = useParams<{
    trusteeId: string;
    appointmentId: string;
  }>();
  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();
  const canManage = useCanManageTrustees();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<Chapter7PanelTrusteeInterimReportFormState>(EMPTY_FORM);
  const [original, setOriginal] = useState<TrusteeUpcomingKeyDates | null>(null);
  const { registerFieldError, hasErrorAmong } = useDateFieldErrors();

  useEffect(() => {
    Api2.getUpcomingKeyDates(trusteeId!, appointmentId!)
      .then((response) => {
        const data = response.data;
        if (data) {
          setOriginal(data);
          const tirFrequency = data.tirFrequency ?? '';
          setForm({
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
          });
        }
      })
      .catch((err) => {
        globalAlert?.error(
          `Failed to load Trustee Interim Report key dates: ${(err as Error).message}`,
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [trusteeId, appointmentId]);

  function handleFrequencyChange(ev: React.ChangeEvent<HTMLSelectElement>) {
    const freq = ev.target.value as TirFrequency;
    setForm((prev) => ({
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
      setForm((prev) => ({
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
      form.tirFrequency === 'ANNUAL'
        ? ANNUAL_OPTIONS
        : form.tirFrequency === 'SEMI_ANNUAL'
          ? SEMI_ANNUAL_OPTIONS
          : [];
    // The DOM's <option> elements are generated from allOptions, so key always
    // resolves to one of them -- there is no "not found" state to guard against.
    const option = allOptions.find((o) => o.key === key)!;
    setForm((prev) => ({
      ...prev,
      tirPeriodKey: key,
      tirReviewPeriodStart: option.start,
      tirReviewPeriodEnd: option.end,
      tirSemiAnnualReviewPeriodStart: option.start2 ?? '',
      tirSemiAnnualReviewPeriodEnd: option.end2 ?? '',
    }));
  }

  async function handleSave() {
    setIsSaving(true);
    const input = buildTrusteeInterimReportKeyDatesInput(
      { trusteeId: trusteeId!, appointmentId: appointmentId! },
      original,
      form,
    );

    try {
      await Api2.putUpcomingKeyDates(trusteeId!, appointmentId!, input);
      navigate(`/trustees/${trusteeId}/appointments`);
    } catch (err) {
      globalAlert?.error(
        `Failed to save Trustee Interim Report key dates: ${(err as Error).message}`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    navigate(`/trustees/${trusteeId}/appointments`);
  }

  if (isLoading) {
    return <LoadingSpinner id="edit-chapter7-panel-tir-loading" />;
  }

  if (!canManage) {
    return (
      <Stop
        id="forbidden-alert"
        title="Forbidden"
        message="You do not have permission to manage Trustee Interim Report Key Dates"
        asError
      />
    );
  }

  const periodOptions = form.tirFrequency === 'ANNUAL' ? ANNUAL_OPTIONS : SEMI_ANNUAL_OPTIONS;
  const tirPeriodPairError = validateCompletionPairPresence(
    form.tirFrequency,
    form.tirPeriodKey,
    'Trustee Interim Report (TIR) Period',
    { first: 'Frequency', second: 'Period' },
  );
  const tirPeriodPairErrorId = 'tir-period-pair-error';
  const completionPairError = validateCompletionPairPresence(
    form.tirCompletionYear,
    form.tirCompletionStatus,
    'Trustee Interim Report Completion Status',
  );
  const completionPairErrorId = 'tir-completion-status-error';

  return (
    <div className="edit-upcoming-key-dates" data-testid="edit-chapter7-panel-tir">
      <h3>Edit Trustee Interim Report (TIR) Key Dates</h3>

      <div className="tir-period-group">
        <p className="usa-label">TIR Period</p>
        <div className="tir-period-group__row">
          <Select
            id="tir-frequency"
            label="Frequency"
            compactLabel
            hasError={!!tirPeriodPairError}
            ariaDescribedBy={tirPeriodPairError ? tirPeriodPairErrorId : undefined}
            placeholder="- Select -"
            options={[
              { value: 'ANNUAL', label: 'Annual' },
              { value: 'SEMI_ANNUAL', label: 'Semi-Annual' },
            ]}
            value={form.tirFrequency}
            onChange={handleFrequencyChange}
          />
          <Select
            id="tir-period"
            label="Period"
            compactLabel
            hasError={!!tirPeriodPairError}
            ariaDescribedBy={tirPeriodPairError ? tirPeriodPairErrorId : undefined}
            placeholder="- Select -"
            options={periodOptions.map((o) => ({ value: o.key, label: o.label }))}
            value={form.tirPeriodKey}
            onChange={handlePeriodChange}
            disabled={!form.tirFrequency}
          />
        </div>
        {tirPeriodPairError && (
          <span
            className="cams-field-error-message"
            id={tirPeriodPairErrorId}
            data-testid={tirPeriodPairErrorId}
          >
            {tirPeriodPairError}
          </span>
        )}
      </div>

      <DatePicker
        id="past-tpr-submission"
        label="Last TIR Letter"
        value={form.pastTprSubmission}
        onChange={(e) => setForm((prev) => ({ ...prev, pastTprSubmission: e.target.value }))}
        onValidationChange={(hasError) => registerFieldError('past-tpr-submission', hasError)}
        disableMax
      />

      <div className="exam-audit-group">
        <p className="usa-label">TIR Completion Status for Year</p>
        <div className="exam-audit-group__row">
          <Select
            id="tir-completion-status-year"
            label="Year"
            compactLabel
            hasError={!!completionPairError}
            ariaDescribedBy={completionPairError ? completionPairErrorId : undefined}
            placeholder="- Select -"
            options={FISCAL_YEAR_OPTIONS.map((year) => ({
              value: String(year),
              label: String(year),
            }))}
            value={form.tirCompletionYear === '' ? '' : String(form.tirCompletionYear)}
            onChange={(e) => {
              const val = e.target.value;
              setForm((prev) => ({
                ...prev,
                tirCompletionYear: val ? Number(val) : '',
              }));
            }}
          />
          <Select
            id="tir-completion-status-status"
            label="Status"
            compactLabel
            hasError={!!completionPairError}
            ariaDescribedBy={completionPairError ? completionPairErrorId : undefined}
            placeholder="- Select -"
            options={[
              { value: 'COMPLETE', label: 'Complete' },
              { value: 'INCOMPLETE', label: 'Incomplete' },
            ]}
            value={form.tirCompletionStatus}
            onChange={(e) => {
              setForm((prev) => ({
                ...prev,
                tirCompletionStatus: e.target.value as TirCompletionStatus | '',
              }));
            }}
          />
        </div>
        {completionPairError && (
          <span
            className="cams-field-error-message"
            id={completionPairErrorId}
            data-testid={completionPairErrorId}
          >
            {completionPairError}
          </span>
        )}
      </div>

      <div className="usa-button-group">
        <Button
          id="save-chapter7-panel-tir"
          data-testid="button-save-chapter7-panel-tir"
          onClick={handleSave}
          disabled={
            isSaving ||
            !!tirPeriodPairError ||
            !!completionPairError ||
            hasErrorAmong(['past-tpr-submission'])
          }
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id="cancel-chapter7-panel-tir"
          data-testid="button-cancel-chapter7-panel-tir"
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
