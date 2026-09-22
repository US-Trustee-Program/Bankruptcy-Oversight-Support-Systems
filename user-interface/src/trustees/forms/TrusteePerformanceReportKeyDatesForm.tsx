import './EditUpcomingKeyDates.scss';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  validateCompletionPairPresence,
  validateTrusteeUpcomingKeyDates,
} from '@common/cams/trustee-upcoming-key-dates';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import MonthDaySelector from '@/lib/components/uswds/MonthDaySelector';
import MonthDayRangeSelector from '@/lib/components/uswds/MonthDayRangeSelector';
import DatePicker from '@/lib/components/uswds/DatePicker';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import useDateFieldErrors from '@/lib/hooks/UseDateFieldErrors';
import { Stop } from '@/lib/components/Stop';
import { mergeKeyDatesInput } from './chapter7PanelKeyDatesInput';
import CompletionStatusFields, { CompletionStatusValue } from './CompletionStatusFields';
import { resolveKeyDatesSaveError } from './keyDatesSaveError';

type TprFormState = {
  tprReviewPeriodStart: string;
  tprReviewPeriodEnd: string;
  tprFrequency: 'BIANNUAL' | 'ANNUAL' | 'SEMI_ANNUAL' | '';
  tprDue: string;
  tprDueYearType: string;
  lastTprSubmitted: string;
};

const EMPTY_FORM: TprFormState = {
  tprReviewPeriodStart: '',
  tprReviewPeriodEnd: '',
  tprFrequency: '',
  tprDue: '',
  tprDueYearType: '',
  lastTprSubmitted: '',
};

// The validator checks the whole merged document, so save errors have to be
// sorted into this form's fields and everything else.
const OWNED_FIELDS = [
  'tprReviewPeriodStart',
  'tprReviewPeriodEnd',
  'tprFrequency',
  'tprDue',
  'tprDueYearType',
  'lastTprSubmitted',
  'tprCompletionYear',
  'tprCompletionStatus',
] as const;

const FREQUENCY_OPTIONS: { value: TprFormState['tprFrequency']; label: string }[] = [
  { value: 'SEMI_ANNUAL', label: '6 months' },
  { value: 'ANNUAL', label: 'One year' },
  { value: 'BIANNUAL', label: 'Two years' },
];

export default function TrusteePerformanceReportKeyDatesForm() {
  const { trusteeId, appointmentId } = useParams<{
    trusteeId: string;
    appointmentId: string;
  }>();
  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();
  const canManage = useCanManageTrustees();
  const { registerFieldError, hasErrorAmong } = useDateFieldErrors();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<TprFormState>(EMPTY_FORM);
  const [completion, setCompletion] = useState<CompletionStatusValue>({ year: '', status: '' });
  const [original, setOriginal] = useState<TrusteeUpcomingKeyDates | null>(null);
  const [error, setError] = useState('');
  const [reviewPeriodValid, setReviewPeriodValid] = useState(true);

  useEffect(() => {
    Api2.getUpcomingKeyDates(trusteeId!, appointmentId!)
      .then((response) => {
        const data = response.data;
        if (data) {
          setOriginal(data);
          setForm({
            tprReviewPeriodStart: data.tprReviewPeriodStart ?? '',
            tprReviewPeriodEnd: data.tprReviewPeriodEnd ?? '',
            tprFrequency: data.tprFrequency ?? '',
            tprDue: data.tprDue ?? '',
            tprDueYearType: data.tprDueYearType ?? '',
            lastTprSubmitted: data.lastTprSubmitted ?? '',
          });
          setCompletion({
            year: data.tprCompletionYear ?? '',
            status: data.tprCompletionStatus ?? '',
          });
        }
      })
      .catch((err) => {
        globalAlert?.error(
          `Failed to load trustee performance report key dates: ${(err as Error).message}`,
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [trusteeId, appointmentId]);

  function buildInput() {
    return mergeKeyDatesInput({ trusteeId: trusteeId!, appointmentId: appointmentId! }, original, {
      tprReviewPeriodStart: form.tprReviewPeriodStart || null,
      tprReviewPeriodEnd: form.tprReviewPeriodEnd || null,
      tprFrequency: form.tprFrequency || null,
      tprDue: form.tprDue || null,
      tprDueYearType: form.tprDueYearType || null,
      lastTprSubmitted: form.lastTprSubmitted || null,
      tprCompletionYear: completion.year === '' ? null : completion.year,
      tprCompletionStatus: completion.status === '' ? null : completion.status,
    });
  }

  async function handleSave() {
    const input = buildInput();
    const result = validateTrusteeUpcomingKeyDates(input);
    if (!result.valid) {
      setError(resolveKeyDatesSaveError(result.reasonMap, OWNED_FIELDS));
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      await Api2.putUpcomingKeyDates(trusteeId!, appointmentId!, input);
      navigate(`/trustees/${trusteeId}/appointments`);
    } catch (err) {
      globalAlert?.error(
        `Failed to save trustee performance report key dates: ${(err as Error).message}`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    navigate(`/trustees/${trusteeId}/appointments`);
  }

  if (isLoading) {
    return <LoadingSpinner id="edit-tpr-key-dates-loading" />;
  }

  if (!canManage) {
    return (
      <Stop
        id="forbidden-alert"
        title="Forbidden"
        message="You do not have permission to manage Trustee Performance Report Key Dates"
        asError
      />
    );
  }

  const completionPairError = validateCompletionPairPresence(
    completion.year,
    completion.status,
    'Trustee Performance Review Completion Status',
  );
  const saveDisabled =
    isSaving ||
    !reviewPeriodValid ||
    hasErrorAmong(['last-tpr-submitted']) ||
    !!completionPairError;

  return (
    <div className="edit-upcoming-key-dates" data-testid="edit-tpr-key-dates">
      <h3>Edit Trustee Performance Report</h3>
      {error && (
        <Alert id="tpr-completion-error" type={UswdsAlertStyle.Error} inline show slim>
          {error}
        </Alert>
      )}
      <MonthDayRangeSelector
        id="tpr-review-period"
        label="TPR Review Period"
        startValue={form.tprReviewPeriodStart}
        endValue={form.tprReviewPeriodEnd}
        onStartChange={(value) => setForm((prev) => ({ ...prev, tprReviewPeriodStart: value }))}
        onEndChange={(value) => setForm((prev) => ({ ...prev, tprReviewPeriodEnd: value }))}
        onValidationChange={setReviewPeriodValid}
      />
      <div className="usa-form-group">
        <label className="usa-label" htmlFor="tpr-frequency">
          TPR Review Period Frequency
        </label>
        <select
          className="usa-select"
          id="tpr-frequency"
          data-testid="tpr-frequency"
          value={form.tprFrequency}
          onChange={(ev) =>
            setForm((prev) => ({
              ...prev,
              tprFrequency: ev.target.value as TprFormState['tprFrequency'],
            }))
          }
        >
          <option value="">- Select -</option>
          {FREQUENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="usa-form-group">
        <p className="usa-label">TPR Due</p>
        <MonthDaySelector
          id="tpr-due"
          value={form.tprDue}
          onChange={(value) => setForm((prev) => ({ ...prev, tprDue: value }))}
        />
        <div className="usa-form-group year-type-selector">
          <label className="usa-hint" htmlFor="tpr-due-year-type">
            Year Type
          </label>
          <select
            className="usa-select"
            id="tpr-due-year-type"
            data-testid="tpr-due-year-type"
            value={form.tprDueYearType}
            onChange={(ev) => setForm((prev) => ({ ...prev, tprDueYearType: ev.target.value }))}
          >
            <option value="">- Select -</option>
            <option value="EVEN">EVEN</option>
            <option value="ODD">ODD</option>
          </select>
        </div>
      </div>
      <DatePicker
        id="last-tpr-submitted"
        label="Last TPR Submitted"
        value={form.lastTprSubmitted}
        onChange={(ev) => setForm((prev) => ({ ...prev, lastTprSubmitted: ev.target.value }))}
        onValidationChange={(hasError) => registerFieldError('last-tpr-submitted', hasError)}
      />
      <CompletionStatusFields
        idPrefix="tpr-completion"
        legend="TPR Completion"
        value={completion}
        onChange={setCompletion}
        errorLabel="Trustee Performance Review Completion Status"
      />
      <div className="usa-button-group">
        <Button
          id="save-tpr-key-dates"
          data-testid="button-save-tpr-key-dates"
          onClick={handleSave}
          disabled={saveDisabled}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id="cancel-tpr-key-dates"
          data-testid="button-cancel-tpr-key-dates"
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
