import './Chapter13StandingTrusteePerformanceReportForm.scss';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Ch13CompletionStatus,
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
  validateTprDuePair,
} from '@common/cams/trustee-upcoming-key-dates';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import DatePicker from '@/lib/components/uswds/DatePicker';
import MonthDaySelector from '@/lib/components/uswds/MonthDaySelector';
import Select from '@/lib/components/uswds/Select';
import useDateFieldErrors from '@/lib/hooks/UseDateFieldErrors';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { Stop } from '@/lib/components/Stop';
import { buildKeyDatesInputFromOriginal } from './keyDatesInputDefaults';
import CompletionStatusYearSelect from './CompletionStatusYearSelect';

type FormState = {
  tprReviewPeriodStart: string;
  tprReviewPeriodEnd: string;
  tprFrequency: 'BIANNUAL' | 'ANNUAL' | 'SEMI_ANNUAL' | '';
  tprDue: string;
  tprDueYearType: 'EVEN' | 'ODD' | '';
  pastTprSubmission: string;
  ch13TprCompletionYear: number | '';
  ch13TprCompletionStatus: Ch13CompletionStatus | '';
};

const EMPTY_FORM: FormState = {
  tprReviewPeriodStart: '',
  tprReviewPeriodEnd: '',
  tprFrequency: '',
  tprDue: '',
  tprDueYearType: '',
  pastTprSubmission: '',
  ch13TprCompletionYear: '',
  ch13TprCompletionStatus: '',
};

function buildFormStateFromData(data: TrusteeUpcomingKeyDates): FormState {
  return {
    tprReviewPeriodStart: data.tprReviewPeriodStart ?? '',
    tprReviewPeriodEnd: data.tprReviewPeriodEnd ?? '',
    tprFrequency: data.tprFrequency ?? '',
    tprDue: data.tprDue ?? '',
    tprDueYearType: data.tprDueYearType ?? '',
    pastTprSubmission: data.pastTprSubmission ?? '',
    ch13TprCompletionYear: data.ch13TprCompletionYear ?? '',
    ch13TprCompletionStatus: data.ch13TprCompletionStatus ?? '',
  };
}

function buildInput(
  trusteeId: string,
  appointmentId: string,
  original: TrusteeUpcomingKeyDates | null,
  form: FormState,
): TrusteeUpcomingKeyDatesInput {
  return {
    ...buildKeyDatesInputFromOriginal(trusteeId, appointmentId, original),
    pastTprSubmission: form.pastTprSubmission || null,
    tprReviewPeriodStart: form.tprReviewPeriodStart || null,
    tprReviewPeriodEnd: form.tprReviewPeriodEnd || null,
    tprDue: form.tprDue || null,
    tprDueYearType: form.tprDueYearType || null,
    tprFrequency: form.tprFrequency || null,
    ch13TprCompletionYear: form.ch13TprCompletionYear || null,
    ch13TprCompletionStatus: form.ch13TprCompletionStatus || null,
  };
}

export default function Chapter13StandingTrusteePerformanceReportForm() {
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
  const [loadFailed, setLoadFailed] = useState(false);
  const [original, setOriginal] = useState<TrusteeUpcomingKeyDates | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [reviewPeriodError, setReviewPeriodError] = useState('');

  useEffect(() => {
    Api2.getUpcomingKeyDates(trusteeId!, appointmentId!)
      .then((response) => {
        setOriginal(response.data);
        if (response.data) {
          setForm(buildFormStateFromData(response.data));
        }
      })
      .catch((err) => {
        setLoadFailed(true);
        globalAlert?.error(
          `Failed to load Trustee Performance Report key dates: ${(err as Error).message}`,
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trusteeId, appointmentId]);

  function handleCancel() {
    navigate(`/trustees/${trusteeId}/appointments`);
  }

  function checkReviewPeriodOrder(start: string, end: string) {
    if (start && end && start > end) {
      setReviewPeriodError('TPR Review Period Start must be before TPR Review Period End.');
    } else {
      setReviewPeriodError('');
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const input = buildInput(trusteeId!, appointmentId!, original, form);
      await Api2.putUpcomingKeyDates(trusteeId!, appointmentId!, input);
      navigate(`/trustees/${trusteeId}/appointments`);
    } catch (err) {
      globalAlert?.error(
        `Failed to save Trustee Performance Report key dates: ${(err as Error).message}`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <LoadingSpinner id="edit-chapter13-standing-tpr-key-dates-loading" />;
  }

  if (!canManage) {
    return (
      <Stop
        id="forbidden-alert"
        title="Forbidden"
        message="You do not have permission to manage Trustee Upcoming Key Dates"
        asError
      />
    );
  }

  const tprDueBlurError = validateTprDuePair(form.tprDue, form.tprDueYearType);

  const isCompletionPairIncomplete =
    (!!form.ch13TprCompletionYear && !form.ch13TprCompletionStatus) ||
    (!form.ch13TprCompletionYear && !!form.ch13TprCompletionStatus);

  const isSaveDisabled =
    isSaving ||
    loadFailed ||
    !!reviewPeriodError ||
    !!tprDueBlurError ||
    hasErrorAmong(['tpr-review-period-start', 'tpr-review-period-end', 'last-tpr-submitted']) ||
    isCompletionPairIncomplete;

  return (
    <div
      className="edit-chapter13-standing-tpr-key-dates"
      data-testid="edit-chapter13-standing-tpr-key-dates"
    >
      <h3>Edit Trustee Performance Report Key Dates</h3>
      <div className="tpr-review-period-group">
        <DatePicker
          id="tpr-review-period-start"
          label="Trustee Performance Review (TPR) Period Start"
          value={form.tprReviewPeriodStart}
          disableMax
          onChange={(e) => {
            setForm((prev) => ({ ...prev, tprReviewPeriodStart: e.target.value }));
            checkReviewPeriodOrder(e.target.value, form.tprReviewPeriodEnd);
          }}
          onValidationChange={(hasError) => registerFieldError('tpr-review-period-start', hasError)}
        />
        <DatePicker
          id="tpr-review-period-end"
          label="Trustee Performance Review (TPR) Period End"
          value={form.tprReviewPeriodEnd}
          disableMax
          onChange={(e) => {
            setForm((prev) => ({ ...prev, tprReviewPeriodEnd: e.target.value }));
            checkReviewPeriodOrder(form.tprReviewPeriodStart, e.target.value);
          }}
          onValidationChange={(hasError) => registerFieldError('tpr-review-period-end', hasError)}
        />
        {reviewPeriodError && (
          <span className="cams-field-error-message" data-testid="tpr-review-period-error">
            {reviewPeriodError}
          </span>
        )}
      </div>
      <Select
        id="tpr-frequency"
        label="Trustee Performance Review (TPR) Period Frequency"
        className={`tpr-frequency-group${form.tprFrequency === '' ? ' tpr-frequency-placeholder' : ''}`}
        placeholder="- Select -"
        options={[
          { value: 'BIANNUAL', label: 'Two years' },
          { value: 'ANNUAL', label: 'One year' },
          { value: 'SEMI_ANNUAL', label: '6 months' },
        ]}
        value={form.tprFrequency}
        onChange={(e) =>
          setForm((prev) => ({
            ...prev,
            tprFrequency: e.target.value as 'BIANNUAL' | 'ANNUAL' | 'SEMI_ANNUAL' | '',
          }))
        }
      />
      <div className="tpr-due-group">
        <p className="usa-label tpr-due-title">Trustee Performance Review (TPR) Due</p>
        <div className="tpr-due-group__row">
          <MonthDaySelector
            id="tpr-due"
            value={form.tprDue}
            onChange={(value) => setForm((prev) => ({ ...prev, tprDue: value }))}
            dayAlwaysEnabled
          />
          <Select
            id="tpr-due-year-type"
            label="Year Type"
            compactLabel
            placeholder="- Select -"
            options={[
              { value: 'EVEN', label: 'EVEN' },
              { value: 'ODD', label: 'ODD' },
            ]}
            value={form.tprDueYearType}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                tprDueYearType: e.target.value as 'EVEN' | 'ODD' | '',
              }))
            }
          />
        </div>
        {tprDueBlurError && (
          <span className="cams-field-error-message" data-testid="tpr-due-error">
            {tprDueBlurError}
          </span>
        )}
      </div>
      <DatePicker
        id="last-tpr-submitted"
        label="Last Trustee Performance Review (TPR) Submitted"
        value={form.pastTprSubmission}
        disableMax
        onChange={(e) => setForm((prev) => ({ ...prev, pastTprSubmission: e.target.value }))}
        onValidationChange={(hasError) => registerFieldError('last-tpr-submitted', hasError)}
      />
      <CompletionStatusYearSelect
        idPrefix="tpr-completion"
        title="TPR Completion Status for Year"
        year={form.ch13TprCompletionYear}
        status={form.ch13TprCompletionStatus}
        onYearChange={(ch13TprCompletionYear) =>
          setForm((prev) => ({ ...prev, ch13TprCompletionYear }))
        }
        onStatusChange={(ch13TprCompletionStatus) =>
          setForm((prev) => ({ ...prev, ch13TprCompletionStatus }))
        }
      />
      <div className="usa-button-group">
        <Button
          id="save-chapter13-standing-tpr-key-dates"
          onClick={handleSave}
          disabled={isSaveDisabled}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id="cancel-chapter13-standing-tpr-key-dates"
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
