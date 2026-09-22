import './EditUpcomingKeyDates.scss';
import '@/lib/components/uswds/forms.scss';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useFeatureFlags, { TPR_DISPLAY_UPDATES } from '@/lib/hooks/UseFeatureFlags';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
  validateTprDuePair,
  validateCompletionPairPresence,
  validateTrusteeUpcomingKeyDates,
  isoToSentinel,
} from '@common/cams/trustee-upcoming-key-dates';
import { mergeKeyDatesInput, FISCAL_YEAR_OPTIONS } from './chapter7PanelKeyDatesInput';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import DatePicker from '@/lib/components/uswds/DatePicker';
import MonthDaySelector from '@/lib/components/uswds/MonthDaySelector';
import MonthDayRangeSelector from '@/lib/components/uswds/MonthDayRangeSelector';
import useDateFieldErrors from '@/lib/hooks/UseDateFieldErrors';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { Stop } from '@/lib/components/Stop';

type TprCompletionStatus = 'COMPLETE' | 'INCOMPLETE';

type Chapter7PanelTrusteePerformanceReportFormState = {
  tprReviewPeriodStart: string;
  tprReviewPeriodEnd: string;
  tprFrequency: 'BIANNUAL' | 'ANNUAL' | 'SEMI_ANNUAL' | '';
  tprDue: string;
  tprDueYearType: 'EVEN' | 'ODD' | '';
  lastTprSubmitted: string;
  tprCompletionYear: number | '';
  tprCompletionStatus: TprCompletionStatus | '';
};

const EMPTY_FORM: Chapter7PanelTrusteePerformanceReportFormState = {
  tprReviewPeriodStart: '',
  tprReviewPeriodEnd: '',
  tprFrequency: '',
  tprDue: '',
  tprDueYearType: '',
  lastTprSubmitted: '',
  tprCompletionYear: '',
  tprCompletionStatus: '',
};

export function buildTrusteePerformanceReportKeyDatesInput(
  ids: { trusteeId: string; appointmentId: string },
  original: TrusteeUpcomingKeyDates | null,
  form: Chapter7PanelTrusteePerformanceReportFormState,
  tprDisplayUpdates = true,
): TrusteeUpcomingKeyDatesInput {
  return mergeKeyDatesInput(ids, original, {
    lastTprSubmitted: form.lastTprSubmitted || null,
    tprReviewPeriodStart: tprDisplayUpdates
      ? form.tprReviewPeriodStart || null
      : form.tprReviewPeriodStart
        ? isoToSentinel(form.tprReviewPeriodStart)
        : null,
    tprReviewPeriodEnd: tprDisplayUpdates
      ? form.tprReviewPeriodEnd || null
      : form.tprReviewPeriodEnd
        ? isoToSentinel(form.tprReviewPeriodEnd)
        : null,
    tprDue: form.tprDue || null,
    tprDueYearType: form.tprDueYearType || null,
    tprFrequency: form.tprFrequency || null,
    tprCompletionYear: form.tprCompletionYear !== '' ? form.tprCompletionYear : null,
    tprCompletionStatus: form.tprCompletionStatus || null,
  });
}

export default function Chapter7PanelTrusteePerformanceReportForm() {
  const { trusteeId, appointmentId } = useParams<{
    trusteeId: string;
    appointmentId: string;
  }>();
  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();
  const canManage = useCanManageTrustees();
  const tprDisplayUpdates = !!useFeatureFlags()[TPR_DISPLAY_UPDATES];

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<Chapter7PanelTrusteePerformanceReportFormState>(EMPTY_FORM);
  const [original, setOriginal] = useState<TrusteeUpcomingKeyDates | null>(null);
  const [tprReviewPeriodValid, setTprReviewPeriodValid] = useState(true);
  const [errors, setErrors] = useState({ tprReviewPeriodStart: '', tprReviewPeriodEnd: '' });
  const { registerFieldError, hasErrorAmong } = useDateFieldErrors();

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
            tprCompletionYear: data.tprCompletionYear ?? '',
            tprCompletionStatus: data.tprCompletionStatus ?? '',
          });
        }
      })
      .catch((err) => {
        globalAlert?.error(
          `Failed to load Trustee Performance Report key dates: ${(err as Error).message}`,
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [trusteeId, appointmentId]);

  async function handleSave() {
    const input = buildTrusteePerformanceReportKeyDatesInput(
      { trusteeId: trusteeId!, appointmentId: appointmentId! },
      original,
      form,
      tprDisplayUpdates,
    );

    const result = validateTrusteeUpcomingKeyDates(input);
    setErrors({
      tprReviewPeriodStart: result.reasonMap?.tprReviewPeriodStart?.reasons?.[0] ?? '',
      tprReviewPeriodEnd: result.reasonMap?.tprReviewPeriodEnd?.reasons?.[0] ?? '',
    });
    if ((!tprDisplayUpdates && !tprReviewPeriodValid) || !result.valid) return;

    setIsSaving(true);
    try {
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

  function handleCancel() {
    navigate(`/trustees/${trusteeId}/appointments`);
  }

  if (isLoading) {
    return <LoadingSpinner id="edit-chapter7-panel-tpr-loading" />;
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

  const tprPeriodError =
    tprDisplayUpdates &&
    form.tprReviewPeriodStart &&
    form.tprReviewPeriodEnd &&
    form.tprReviewPeriodStart > form.tprReviewPeriodEnd
      ? 'TPR Review Period Start must be before TPR Review Period End.'
      : '';
  const tprDuePairError = validateTprDuePair(form.tprDue, form.tprDueYearType);
  const hasAnyDateError = tprDisplayUpdates
    ? hasErrorAmong(['tpr-review-period-start', 'tpr-review-period-end', 'last-tpr-submitted'])
    : hasErrorAmong(['last-tpr-submitted']);
  const completionPairError = validateCompletionPairPresence(
    form.tprCompletionYear,
    form.tprCompletionStatus,
    'Trustee Performance Review Completion Status',
  );
  const isSaveDisabled =
    isSaving ||
    hasAnyDateError ||
    !!tprPeriodError ||
    !!tprDuePairError ||
    !!completionPairError ||
    (!tprDisplayUpdates && !tprReviewPeriodValid);

  return (
    <div className="edit-upcoming-key-dates" data-testid="edit-chapter7-panel-tpr">
      <h3>Edit Trustee Performance Report Key Dates</h3>

      {tprDisplayUpdates ? (
        <div
          onFocus={(e) => {
            const id = (e.target as HTMLElement).id;
            if (id === 'tpr-review-period-start') {
              setErrors((prev) => ({ ...prev, tprReviewPeriodStart: '' }));
            } else if (id === 'tpr-review-period-end') {
              setErrors((prev) => ({ ...prev, tprReviewPeriodEnd: '' }));
            }
          }}
          onBlur={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            const { tprReviewPeriodStart: start, tprReviewPeriodEnd: end } = form;
            if (!start || !end || start <= end) return;
            setErrors((prev) => ({
              ...prev,
              tprReviewPeriodStart: 'TPR Review Period Start must be before TPR Review Period End.',
              tprReviewPeriodEnd: 'TPR Review Period End must be after TPR Review Period Start.',
            }));
          }}
        >
          <DatePicker
            id="tpr-review-period-start"
            label="Trustee Performance Review (TPR) Period Start"
            value={form.tprReviewPeriodStart}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, tprReviewPeriodStart: e.target.value }));
              setErrors((prev) => ({ ...prev, tprReviewPeriodStart: '', tprReviewPeriodEnd: '' }));
            }}
            onValidationChange={(hasError) =>
              registerFieldError('tpr-review-period-start', hasError)
            }
            customErrorMessage={errors.tprReviewPeriodStart}
            disableMax
          />
          <DatePicker
            id="tpr-review-period-end"
            label="Trustee Performance Review (TPR) Period End"
            value={form.tprReviewPeriodEnd}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, tprReviewPeriodEnd: e.target.value }));
              setErrors((prev) => ({ ...prev, tprReviewPeriodStart: '', tprReviewPeriodEnd: '' }));
            }}
            onValidationChange={(hasError) => registerFieldError('tpr-review-period-end', hasError)}
            customErrorMessage={errors.tprReviewPeriodEnd}
            disableMax
          />
          {tprPeriodError && (
            <span className="usa-input__error-message" data-testid="tpr-review-period-error">
              {tprPeriodError}
            </span>
          )}
        </div>
      ) : (
        <MonthDayRangeSelector
          id="tpr-review-period"
          label="Trustee Performance Review (TPR) Period"
          startValue={form.tprReviewPeriodStart}
          endValue={form.tprReviewPeriodEnd}
          onStartChange={(value) => setForm((prev) => ({ ...prev, tprReviewPeriodStart: value }))}
          onEndChange={(value) => setForm((prev) => ({ ...prev, tprReviewPeriodEnd: value }))}
          onValidationChange={(isValid) => setTprReviewPeriodValid(isValid)}
        />
      )}

      {tprDisplayUpdates && (
        <div className="usa-form-group">
          <label className="usa-label" htmlFor="tpr-frequency">
            Trustee Performance Review Period Frequency
          </label>
          <select
            className="usa-select"
            id="tpr-frequency"
            data-testid="tpr-frequency"
            value={form.tprFrequency}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                tprFrequency: e.target.value as 'BIANNUAL' | 'ANNUAL' | 'SEMI_ANNUAL' | '',
              }))
            }
          >
            <option value="">- Select -</option>
            <option value="BIANNUAL">Two years</option>
            <option value="ANNUAL">One year</option>
            <option value="SEMI_ANNUAL">6 months</option>
          </select>
        </div>
      )}

      <div className="tpr-due-group">
        <div className="tpr-due-group__header">
          <label className="usa-label" htmlFor="tpr-due">
            Trustee Performance Review (TPR) Due
          </label>
        </div>
        <div className="tpr-due-group__row">
          <MonthDaySelector
            id="tpr-due"
            value={form.tprDue}
            onChange={(value) => setForm((prev) => ({ ...prev, tprDue: value }))}
            hasError={!!tprDuePairError}
          />
          <div className="usa-form-group year-type-selector">
            <label htmlFor="tpr-due-year-type" className="usa-hint">
              Year Type
            </label>
            <select
              className="usa-select"
              id="tpr-due-year-type"
              data-testid="tpr-due-year-type"
              value={form.tprDueYearType}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  tprDueYearType: e.target.value as 'EVEN' | 'ODD' | '',
                }))
              }
            >
              <option value="">- Select -</option>
              <option value="EVEN">EVEN</option>
              <option value="ODD">ODD</option>
            </select>
          </div>
        </div>
        {tprDuePairError && (
          <span className="usa-input__error-message" data-testid="tpr-due-error">
            {tprDuePairError}
          </span>
        )}
      </div>

      <DatePicker
        id="last-tpr-submitted"
        label="Last Trustee Performance Review Submitted"
        value={form.lastTprSubmitted}
        onChange={(e) => setForm((prev) => ({ ...prev, lastTprSubmitted: e.target.value }))}
        onValidationChange={(hasError) => registerFieldError('last-tpr-submitted', hasError)}
        disableMax
      />

      <div className="exam-audit-group">
        <p className="usa-label">TPR Completion Status for Year</p>
        <div className="exam-audit-group__row">
          <div className="usa-form-group">
            <label className="usa-hint" htmlFor="tpr-completion-status-year">
              Year
            </label>
            <select
              className={`usa-select${completionPairError ? ' usa-input--error' : ''}`}
              id="tpr-completion-status-year"
              data-testid="tpr-completion-status-year"
              value={form.tprCompletionYear}
              onChange={(e) => {
                const val = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  tprCompletionYear: val ? Number(val) : '',
                }));
              }}
            >
              <option value="">- Select -</option>
              {FISCAL_YEAR_OPTIONS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div className="usa-form-group">
            <label className="usa-hint" htmlFor="tpr-completion-status-status">
              Status
            </label>
            <select
              className={`usa-select${completionPairError ? ' usa-input--error' : ''}`}
              id="tpr-completion-status-status"
              data-testid="tpr-completion-status-status"
              value={form.tprCompletionStatus}
              onChange={(e) => {
                setForm((prev) => ({
                  ...prev,
                  tprCompletionStatus: e.target.value as TprCompletionStatus | '',
                }));
              }}
            >
              <option value="">- Select -</option>
              <option value="COMPLETE">Complete</option>
              <option value="INCOMPLETE">Incomplete</option>
            </select>
          </div>
        </div>
        {completionPairError && (
          <span className="usa-input__error-message" data-testid="tpr-completion-status-error">
            {completionPairError}
          </span>
        )}
      </div>

      <div className="usa-button-group">
        <Button
          id="save-chapter7-panel-tpr"
          data-testid="button-save-chapter7-panel-tpr"
          onClick={handleSave}
          disabled={isSaveDisabled}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id="cancel-chapter7-panel-tpr"
          data-testid="button-cancel-chapter7-panel-tpr"
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
