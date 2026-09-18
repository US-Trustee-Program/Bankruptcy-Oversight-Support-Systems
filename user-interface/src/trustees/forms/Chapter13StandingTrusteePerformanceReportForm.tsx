import './Chapter13StandingTrusteePerformanceReportForm.scss';
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
import DatePicker from '@/lib/components/uswds/DatePicker';
import MonthDaySelector from '@/lib/components/uswds/MonthDaySelector';
import useDateFieldErrors from '@/lib/hooks/UseDateFieldErrors';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import { Stop } from '@/lib/components/Stop';

const currentYear = new Date().getFullYear();
const COMPLETION_YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => currentYear - i);

type FormState = {
  tprReviewPeriodStart: string;
  tprReviewPeriodEnd: string;
  tprFrequency: 'BIANNUAL' | 'ANNUAL' | 'SEMI_ANNUAL' | '';
  tprDue: string;
  tprDueYearType: 'EVEN' | 'ODD' | '';
  pastTprSubmission: string;
  tprCompletionYear: number | '';
  tprCompletionStatus: 'Complete' | 'Incomplete' | '';
};

const EMPTY_FORM: FormState = {
  tprReviewPeriodStart: '',
  tprReviewPeriodEnd: '',
  tprFrequency: '',
  tprDue: '',
  tprDueYearType: '',
  pastTprSubmission: '',
  tprCompletionYear: '',
  tprCompletionStatus: '',
};

function buildFormStateFromData(data: TrusteeUpcomingKeyDates): FormState {
  return {
    tprReviewPeriodStart: data.tprReviewPeriodStart ?? '',
    tprReviewPeriodEnd: data.tprReviewPeriodEnd ?? '',
    tprFrequency: data.tprFrequency ?? '',
    tprDue: data.tprDue ?? '',
    tprDueYearType: data.tprDueYearType ?? '',
    pastTprSubmission: data.pastTprSubmission ?? '',
    tprCompletionYear: data.tprCompletionYear ?? '',
    tprCompletionStatus: data.tprCompletionStatus ?? '',
  };
}

function buildInput(
  trusteeId: string,
  appointmentId: string,
  original: TrusteeUpcomingKeyDates | null,
  form: FormState,
): TrusteeUpcomingKeyDatesInput {
  return {
    trusteeId,
    appointmentId,
    pastBackgroundQuestion: original?.pastBackgroundQuestion ?? null,
    pastFieldExam: original?.pastFieldExam ?? null,
    pastAudit: original?.pastAudit ?? null,
    pastTprSubmission: form.pastTprSubmission || null,
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
    lastMonthlyReportReceived: original?.lastMonthlyReportReceived ?? null,
    leaseExpiration: original?.leaseExpiration ?? null,
    idExpiration: original?.idExpiration ?? null,
    lastCompensationStudy: original?.lastCompensationStudy ?? null,
    bondIssuedDate: original?.bondIssuedDate ?? null,
    bondRenewalDate: original?.bondRenewalDate ?? null,
    auditCompletionYear: original?.auditCompletionYear ?? null,
    auditCompletionStatus: original?.auditCompletionStatus ?? null,
    tprCompletionYear: form.tprCompletionYear || null,
    tprCompletionStatus: form.tprCompletionStatus || null,
  };
}

export default function Chapter13StandingTrusteePerformanceReportForm() {
  const { trusteeId, appointmentId } = useParams<{
    trusteeId: string;
    appointmentId: string;
  }>();
  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();
  const canManage = !!LocalStorage.getSession()?.user?.roles?.includes(CamsRole.TrusteeAdmin);
  const { registerFieldError, hasErrorAmong } = useDateFieldErrors();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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
    (!!form.tprCompletionYear && !form.tprCompletionStatus) ||
    (!form.tprCompletionYear && !!form.tprCompletionStatus);

  const isSaveDisabled =
    isSaving ||
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
          <span className="usa-error-message" data-testid="tpr-review-period-error">
            {reviewPeriodError}
          </span>
        )}
      </div>
      <div className="usa-form-group">
        <label className="usa-label" htmlFor="tpr-frequency">
          Trustee Performance Review (TPR) Period Frequency
        </label>
        <select
          className={`usa-select${form.tprFrequency === '' ? ' tpr-frequency-placeholder' : ''}`}
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
        <p className="usa-label tpr-due-title">Trustee Performance Review (TPR) Due</p>
        <div className="tpr-due-group__row">
          <MonthDaySelector
            id="tpr-due"
            value={form.tprDue}
            onChange={(value) => setForm((prev) => ({ ...prev, tprDue: value }))}
            dayAlwaysEnabled
          />
          <div className="usa-form-group">
            <label className="usa-hint" htmlFor="tpr-due-year-type">
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
              <option value=""></option>
              <option value="EVEN">EVEN</option>
              <option value="ODD">ODD</option>
            </select>
          </div>
        </div>
        {tprDueBlurError && (
          <span className="usa-error-message" data-testid="tpr-due-error">
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
      <div className="tpr-completion-status-group">
        <p className="usa-label tpr-completion-status-title">TPR Completion Status for Year</p>
        <div className="tpr-completion-status-group__row">
          <div className="usa-form-group">
            <label className="usa-hint" htmlFor="tpr-completion-year">
              Year
            </label>
            <select
              className="usa-select"
              id="tpr-completion-year"
              data-testid="tpr-completion-year"
              value={form.tprCompletionYear}
              onChange={(e) => {
                const val = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  tprCompletionYear: val ? Number(val) : '',
                }));
              }}
            >
              <option value=""></option>
              {COMPLETION_YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="usa-form-group">
            <label className="usa-hint" htmlFor="tpr-completion-status">
              Status
            </label>
            <select
              className="usa-select"
              id="tpr-completion-status"
              data-testid="tpr-completion-status"
              value={form.tprCompletionStatus}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  tprCompletionStatus: e.target.value as 'Complete' | 'Incomplete' | '',
                }))
              }
            >
              <option value=""></option>
              <option value="Complete">Complete</option>
              <option value="Incomplete">Incomplete</option>
            </select>
          </div>
        </div>
      </div>
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
