import './EditUpcomingKeyDates.scss';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
  validateTprDuePair,
} from '@common/cams/trustee-upcoming-key-dates';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import DatePicker from '@/lib/components/uswds/DatePicker';
import MonthDaySelector from '@/lib/components/uswds/MonthDaySelector';
import useDateFieldErrors from '@/lib/hooks/UseDateFieldErrors';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { Stop } from '@/lib/components/Stop';

const CURRENT_YEAR = new Date().getFullYear();
const FISCAL_YEAR_OPTIONS = Array.from({ length: 21 }, (_, i) => CURRENT_YEAR - i);

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
): TrusteeUpcomingKeyDatesInput {
  return {
    trusteeId: ids.trusteeId,
    appointmentId: ids.appointmentId,
    pastBackgroundQuestion: original?.pastBackgroundQuestion ?? null,
    pastFieldExam: original?.pastFieldExam ?? null,
    pastAudit: original?.pastAudit ?? null,
    pastTprSubmission: original?.pastTprSubmission ?? null,
    lastTprSubmitted: form.lastTprSubmitted || null,
    tprReviewPeriodStart: form.tprReviewPeriodStart || null,
    tprReviewPeriodEnd: form.tprReviewPeriodEnd || null,
    tprDue: form.tprDue || null,
    tprDueYearType: form.tprDueYearType || null,
    tprFrequency: form.tprFrequency || null,
    tirReviewPeriodStart: original?.tirReviewPeriodStart ?? null,
    tirReviewPeriodEnd: original?.tirReviewPeriodEnd ?? null,
    tirSubmission: original?.tirSubmission ?? null,
    tirReview: original?.tirReview ?? null,
    upcomingExamOrAuditYear: original?.upcomingExamOrAuditYear ?? null,
    upcomingExamOrAuditType: original?.upcomingExamOrAuditType ?? null,
    tirFrequency: original?.tirFrequency ?? null,
    tirSemiAnnualReviewPeriodStart: original?.tirSemiAnnualReviewPeriodStart ?? null,
    tirSemiAnnualReviewPeriodEnd: original?.tirSemiAnnualReviewPeriodEnd ?? null,
    tirSemiAnnualSubmission: original?.tirSemiAnnualSubmission ?? null,
    tirSemiAnnualReview: original?.tirSemiAnnualReview ?? null,
    lastAuditFiscalYear: original?.lastAuditFiscalYear ?? null,
    auditCompletionYear: original?.auditCompletionYear ?? null,
    auditCompletionStatus: original?.auditCompletionStatus ?? null,
    tprCompletionYear: form.tprCompletionYear !== '' ? form.tprCompletionYear : null,
    tprCompletionStatus: form.tprCompletionStatus || null,
    tirCompletionYear: original?.tirCompletionYear ?? null,
    tirCompletionStatus: original?.tirCompletionStatus ?? null,
    lastMonthlyReportReceived: original?.lastMonthlyReportReceived ?? null,
    leaseExpiration: original?.leaseExpiration ?? null,
    idExpiration: original?.idExpiration ?? null,
    lastCompensationStudy: original?.lastCompensationStudy ?? null,
    bondIssuedDate: original?.bondIssuedDate ?? null,
    bondRenewalDate: original?.bondRenewalDate ?? null,
  };
}

export default function Chapter7PanelTrusteePerformanceReportForm() {
  const { trusteeId, appointmentId } = useParams<{
    trusteeId: string;
    appointmentId: string;
  }>();
  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();
  const canManage = useCanManageTrustees();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<Chapter7PanelTrusteePerformanceReportFormState>(EMPTY_FORM);
  const [original, setOriginal] = useState<TrusteeUpcomingKeyDates | null>(null);
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

  function handleDateChange(field: 'lastTprSubmitted') {
    return (ev: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: ev.target.value }));
    };
  }

  async function handleSave() {
    setIsSaving(true);
    const input = buildTrusteePerformanceReportKeyDatesInput(
      { trusteeId: trusteeId!, appointmentId: appointmentId! },
      original,
      form,
    );

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
    form.tprReviewPeriodStart &&
    form.tprReviewPeriodEnd &&
    form.tprReviewPeriodStart > form.tprReviewPeriodEnd
      ? 'TPR Review Period Start must be before TPR Review Period End.'
      : '';
  const tprDuePairError = validateTprDuePair(form.tprDue, form.tprDueYearType);
  const hasAnyDateError = hasErrorAmong([
    'tpr-review-period-start',
    'tpr-review-period-end',
    'last-tpr-submitted',
  ]);
  const isSaveDisabled = isSaving || hasAnyDateError || !!tprPeriodError || !!tprDuePairError;

  return (
    <div className="edit-upcoming-key-dates" data-testid="edit-chapter7-panel-tpr">
      <h3>Edit Trustee Performance Report Key Dates</h3>

      <DatePicker
        id="tpr-review-period-start"
        label="Trustee Performance Review Period Start"
        value={form.tprReviewPeriodStart}
        onChange={(e) => setForm((prev) => ({ ...prev, tprReviewPeriodStart: e.target.value }))}
        onValidationChange={(hasError) => registerFieldError('tpr-review-period-start', hasError)}
        disableMax
      />
      <DatePicker
        id="tpr-review-period-end"
        label="Trustee Performance Review Period End"
        value={form.tprReviewPeriodEnd}
        onChange={(e) => setForm((prev) => ({ ...prev, tprReviewPeriodEnd: e.target.value }))}
        onValidationChange={(hasError) => registerFieldError('tpr-review-period-end', hasError)}
        disableMax
      />
      {tprPeriodError && (
        <span className="usa-error-message" data-testid="tpr-review-period-error">
          {tprPeriodError}
        </span>
      )}

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
          <span className="usa-error-message" data-testid="tpr-due-error">
            {tprDuePairError}
          </span>
        )}
      </div>

      <DatePicker
        id="last-tpr-submitted"
        label="Last TPR Submitted"
        value={form.lastTprSubmitted}
        onChange={handleDateChange('lastTprSubmitted')}
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
              className="usa-select"
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
              className="usa-select"
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
