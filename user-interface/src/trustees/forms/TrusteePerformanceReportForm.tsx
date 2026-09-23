import './EditUpcomingKeyDates.scss';
import '@/lib/components/uswds/forms.scss';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useFeatureFlags, { TPR_DISPLAY_UPDATES } from '@/lib/hooks/UseFeatureFlags';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
  validateTprDuePair,
  validateTprReviewPeriodOrder,
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
import Select from '@/lib/components/uswds/Select';
import MonthDaySelector from '@/lib/components/uswds/MonthDaySelector';
import MonthDayRangeSelector from '@/lib/components/uswds/MonthDayRangeSelector';
import useDateFieldErrors from '@/lib/hooks/UseDateFieldErrors';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { Stop } from '@/lib/components/Stop';

type TrusteePerformanceReportFormVariant = 'chapter7-panel' | 'chapter12-standing';

type TprCompletionStatus = 'COMPLETE' | 'INCOMPLETE';

export type TrusteePerformanceReportFormState = {
  tprReviewPeriodStart: string;
  tprReviewPeriodEnd: string;
  tprFrequency: 'BIANNUAL' | 'ANNUAL' | 'SEMI_ANNUAL' | '';
  tprDue: string;
  tprDueYearType: 'EVEN' | 'ODD' | '';
  lastTprSubmitted: string;
  tprCompletionYear: number | '';
  tprCompletionStatus: TprCompletionStatus | '';
};

const EMPTY_FORM: TrusteePerformanceReportFormState = {
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
  form: TrusteePerformanceReportFormState,
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

export interface TrusteePerformanceReportFormProps {
  variant: TrusteePerformanceReportFormVariant;
}

export default function TrusteePerformanceReportForm(
  props: Readonly<TrusteePerformanceReportFormProps>,
) {
  const { variant } = props;
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
  const [loadFailed, setLoadFailed] = useState(false);
  const [form, setForm] = useState<TrusteePerformanceReportFormState>(EMPTY_FORM);
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
        // A failed GET must block Save: `original` stays null here, same as the
        // legitimate "no document yet" case, but saving would wipe every
        // unrelated key-date field on the shared document via mergeKeyDatesInput.
        setLoadFailed(true);
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
    return <LoadingSpinner id={`edit-${variant}-tpr-loading`} />;
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

  const tprPeriodOrder = tprDisplayUpdates
    ? validateTprReviewPeriodOrder(form.tprReviewPeriodStart, form.tprReviewPeriodEnd)
    : null;
  const tprDuePairError = validateTprDuePair(form.tprDue, form.tprDueYearType);
  const tprDuePairErrorId = 'tpr-due-error';
  const hasAnyDateError = tprDisplayUpdates
    ? hasErrorAmong(['tpr-review-period-start', 'tpr-review-period-end', 'last-tpr-submitted'])
    : hasErrorAmong(['last-tpr-submitted']);
  const completionPairError = validateCompletionPairPresence(
    form.tprCompletionYear,
    form.tprCompletionStatus,
    'Trustee Performance Review Completion Status',
  );
  const completionPairErrorId = 'tpr-completion-status-error';
  const isSaveDisabled =
    isSaving ||
    loadFailed ||
    hasAnyDateError ||
    !!tprPeriodOrder ||
    !!tprDuePairError ||
    !!completionPairError ||
    (!tprDisplayUpdates && !tprReviewPeriodValid);

  return (
    <div className="edit-upcoming-key-dates" data-testid={`edit-${variant}-tpr`}>
      <h3>Edit Trustee Performance Report (TPR) Key Dates</h3>

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
            const order = validateTprReviewPeriodOrder(
              form.tprReviewPeriodStart,
              form.tprReviewPeriodEnd,
            );
            if (!order) return;
            setErrors((prev) => ({
              ...prev,
              tprReviewPeriodStart: order.startError,
              tprReviewPeriodEnd: order.endError,
            }));
          }}
        >
          <DatePicker
            id="tpr-review-period-start"
            label="TPR Period Start"
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
            label="TPR Period End"
            value={form.tprReviewPeriodEnd}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, tprReviewPeriodEnd: e.target.value }));
              setErrors((prev) => ({ ...prev, tprReviewPeriodStart: '', tprReviewPeriodEnd: '' }));
            }}
            onValidationChange={(hasError) => registerFieldError('tpr-review-period-end', hasError)}
            customErrorMessage={errors.tprReviewPeriodEnd}
            disableMax
          />
        </div>
      ) : (
        <MonthDayRangeSelector
          id="tpr-review-period"
          label="TPR Period"
          startValue={form.tprReviewPeriodStart}
          endValue={form.tprReviewPeriodEnd}
          onStartChange={(value) => setForm((prev) => ({ ...prev, tprReviewPeriodStart: value }))}
          onEndChange={(value) => setForm((prev) => ({ ...prev, tprReviewPeriodEnd: value }))}
          onValidationChange={(isValid) => setTprReviewPeriodValid(isValid)}
        />
      )}

      {tprDisplayUpdates && (
        <Select
          id="tpr-frequency"
          label="TPR Period Frequency"
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
      )}

      <div className="tpr-due-group">
        <div className="tpr-due-group__header">
          <label className="usa-label" htmlFor="tpr-due">
            TPR Due
          </label>
        </div>
        <div className="tpr-due-group__row">
          <MonthDaySelector
            id="tpr-due"
            value={form.tprDue}
            onChange={(value) => setForm((prev) => ({ ...prev, tprDue: value }))}
            hasError={!!tprDuePairError}
          />
          <Select
            id="tpr-due-year-type"
            label="Year Type"
            compactLabel
            className="year-type-selector"
            hasError={!!tprDuePairError}
            ariaDescribedBy={tprDuePairError ? tprDuePairErrorId : undefined}
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
        {tprDuePairError && (
          <span
            className="cams-field-error-message"
            id={tprDuePairErrorId}
            data-testid={tprDuePairErrorId}
          >
            {tprDuePairError}
          </span>
        )}
      </div>

      <DatePicker
        id="last-tpr-submitted"
        label="Last TPR Submitted"
        value={form.lastTprSubmitted}
        onChange={(e) => setForm((prev) => ({ ...prev, lastTprSubmitted: e.target.value }))}
        onValidationChange={(hasError) => registerFieldError('last-tpr-submitted', hasError)}
        disableMax
      />

      <div className="exam-audit-group">
        <p className="usa-label">TPR Completion Status for Year</p>
        <div className="exam-audit-group__row">
          <Select
            id="tpr-completion-status-year"
            label="Year"
            compactLabel
            hasError={!!completionPairError}
            ariaDescribedBy={completionPairError ? completionPairErrorId : undefined}
            placeholder="- Select -"
            options={FISCAL_YEAR_OPTIONS.map((year) => ({
              value: String(year),
              label: String(year),
            }))}
            value={form.tprCompletionYear === '' ? '' : String(form.tprCompletionYear)}
            onChange={(e) => {
              const val = e.target.value;
              setForm((prev) => ({
                ...prev,
                tprCompletionYear: val ? Number(val) : '',
              }));
            }}
          />
          <Select
            id="tpr-completion-status-status"
            label="Status"
            compactLabel
            hasError={!!completionPairError}
            ariaDescribedBy={completionPairError ? completionPairErrorId : undefined}
            placeholder="- Select -"
            options={[
              { value: 'COMPLETE', label: 'Complete' },
              { value: 'INCOMPLETE', label: 'Incomplete' },
            ]}
            value={form.tprCompletionStatus}
            onChange={(e) => {
              setForm((prev) => ({
                ...prev,
                tprCompletionStatus: e.target.value as TprCompletionStatus | '',
              }));
            }}
          />
        </div>
        {completionPairError && (
          <div
            className="cams-field-error-message"
            id={completionPairErrorId}
            data-testid={completionPairErrorId}
          >
            {completionPairError}
          </div>
        )}
      </div>

      <div className="usa-button-group">
        <Button
          id={`save-${variant}-tpr`}
          data-testid={`button-save-${variant}-tpr`}
          onClick={handleSave}
          disabled={isSaveDisabled}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id={`cancel-${variant}-tpr`}
          data-testid={`button-cancel-${variant}-tpr`}
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
