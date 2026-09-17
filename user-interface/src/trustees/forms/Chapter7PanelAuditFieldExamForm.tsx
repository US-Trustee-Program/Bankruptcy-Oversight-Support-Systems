import './EditUpcomingKeyDates.scss';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
} from '@common/cams/trustee-upcoming-key-dates';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import DatePicker from '@/lib/components/uswds/DatePicker';
import useDateFieldErrors from '@/lib/hooks/UseDateFieldErrors';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { Stop } from '@/lib/components/Stop';

const CURRENT_YEAR = new Date().getFullYear();
const UPCOMING_YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR + i);
const FISCAL_YEAR_OPTIONS = Array.from({ length: 21 }, (_, i) => CURRENT_YEAR - i);

type AuditCompletionStatus = 'CLOSED' | 'NOT_CLOSED';

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
  return {
    trusteeId: ids.trusteeId,
    appointmentId: ids.appointmentId,
    pastBackgroundQuestion: original?.pastBackgroundQuestion ?? null,
    pastFieldExam: form.pastFieldExam || null,
    pastAudit: form.pastAudit || null,
    pastTprSubmission: original?.pastTprSubmission ?? null,
    tprReviewPeriodStart: original?.tprReviewPeriodStart ?? null,
    tprReviewPeriodEnd: original?.tprReviewPeriodEnd ?? null,
    tprDue: original?.tprDue ?? null,
    tprDueYearType: original?.tprDueYearType ?? null,
    tprFrequency: original?.tprFrequency ?? null,
    tirReviewPeriodStart: original?.tirReviewPeriodStart ?? null,
    tirReviewPeriodEnd: original?.tirReviewPeriodEnd ?? null,
    tirSubmission: original?.tirSubmission ?? null,
    tirReview: original?.tirReview ?? null,
    upcomingExamOrAuditYear:
      form.upcomingExamOrAuditYear !== '' ? form.upcomingExamOrAuditYear : null,
    upcomingExamOrAuditType: form.upcomingExamOrAuditType || null,
    tirFrequency: original?.tirFrequency ?? null,
    tirSemiAnnualReviewPeriodStart: original?.tirSemiAnnualReviewPeriodStart ?? null,
    tirSemiAnnualReviewPeriodEnd: original?.tirSemiAnnualReviewPeriodEnd ?? null,
    tirSemiAnnualSubmission: original?.tirSemiAnnualSubmission ?? null,
    tirSemiAnnualReview: original?.tirSemiAnnualReview ?? null,
    lastAuditFiscalYear: form.lastAuditFiscalYear !== '' ? form.lastAuditFiscalYear : null,
    auditCompletionYear: form.auditCompletionYear !== '' ? form.auditCompletionYear : null,
    auditCompletionStatus: form.auditCompletionStatus || null,
    lastMonthlyReportReceived: original?.lastMonthlyReportReceived ?? null,
    leaseExpiration: original?.leaseExpiration ?? null,
    idExpiration: original?.idExpiration ?? null,
    lastCompensationStudy: original?.lastCompensationStudy ?? null,
    bondIssuedDate: original?.bondIssuedDate ?? null,
    bondRenewalDate: original?.bondRenewalDate ?? null,
  };
}

export default function Chapter7PanelAuditFieldExamForm() {
  const { trusteeId, appointmentId } = useParams<{
    trusteeId: string;
    appointmentId: string;
  }>();
  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();
  const canManage = useCanManageTrustees();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<Chapter7PanelAuditFieldExamFormState>(EMPTY_FORM);
  const [original, setOriginal] = useState<TrusteeUpcomingKeyDates | null>(null);
  const { registerFieldError, hasErrorAmong } = useDateFieldErrors();

  useEffect(() => {
    Api2.getUpcomingKeyDates(trusteeId!, appointmentId!)
      .then((response) => {
        const data = response.data;
        if (data) {
          setOriginal(data);
          setForm({
            upcomingExamOrAuditYear: data.upcomingExamOrAuditYear ?? '',
            upcomingExamOrAuditType: data.upcomingExamOrAuditType ?? '',
            pastAudit: data.pastAudit ?? '',
            lastAuditFiscalYear: data.lastAuditFiscalYear ?? '',
            pastFieldExam: data.pastFieldExam ?? '',
            auditCompletionYear: data.auditCompletionYear ?? '',
            auditCompletionStatus: data.auditCompletionStatus ?? '',
          });
        }
      })
      .catch((err) => {
        globalAlert?.error(`Failed to load Audit/Field Exam key dates: ${(err as Error).message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [trusteeId, appointmentId]);

  function handleDateChange(field: 'pastAudit' | 'pastFieldExam') {
    return (ev: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: ev.target.value }));
    };
  }

  async function handleSave() {
    setIsSaving(true);
    const input = buildAuditFieldExamKeyDatesInput(
      { trusteeId: trusteeId!, appointmentId: appointmentId! },
      original,
      form,
    );

    try {
      await Api2.putUpcomingKeyDates(trusteeId!, appointmentId!, input);
      navigate(`/trustees/${trusteeId}/appointments`);
    } catch (err) {
      globalAlert?.error(`Failed to save Audit/Field Exam key dates: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    navigate(`/trustees/${trusteeId}/appointments`);
  }

  if (isLoading) {
    return <LoadingSpinner id="edit-chapter7-panel-audit-field-exam-loading" />;
  }

  if (!canManage) {
    return (
      <Stop
        id="forbidden-alert"
        title="Forbidden"
        message="You do not have permission to manage Trustee Audit/Field Exam Key Dates"
        asError
      />
    );
  }

  const hasAnyDateError = hasErrorAmong(['past-audit', 'past-field-exam']);

  return (
    <div className="edit-upcoming-key-dates" data-testid="edit-chapter7-panel-audit-field-exam">
      <h3>Edit Audit/Field Exam Key Dates</h3>

      <div className="exam-audit-group">
        <p className="usa-label">Field Exam or Audit</p>
        <div className="exam-audit-group__row">
          <div className="usa-form-group">
            <label className="usa-hint" htmlFor="upcoming-exam-audit-year">
              Year
            </label>
            <select
              className="usa-select"
              id="upcoming-exam-audit-year"
              data-testid="upcoming-exam-audit-year"
              value={form.upcomingExamOrAuditYear}
              onChange={(e) => {
                const val = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  upcomingExamOrAuditYear: val ? Number(val) : '',
                }));
              }}
            >
              <option value="">- Select -</option>
              {UPCOMING_YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="usa-form-group">
            <label className="usa-hint" htmlFor="upcoming-exam-audit-type">
              Type
            </label>
            <select
              className="usa-select"
              id="upcoming-exam-audit-type"
              data-testid="upcoming-exam-audit-type"
              value={form.upcomingExamOrAuditType}
              onChange={(e) => {
                setForm((prev) => ({
                  ...prev,
                  upcomingExamOrAuditType: e.target.value as 'Field Exam' | 'Audit' | '',
                }));
              }}
            >
              <option value="">- Select -</option>
              <option value="Field Exam">Field Exam</option>
              <option value="Audit">Audit</option>
            </select>
          </div>
        </div>
      </div>

      <DatePicker
        id="past-audit"
        label="Audit Report Date"
        value={form.pastAudit}
        onChange={handleDateChange('pastAudit')}
        onValidationChange={(hasError) => registerFieldError('past-audit', hasError)}
        disableMax
      />

      <div className="usa-form-group">
        <label className="usa-label" htmlFor="last-audit-fiscal-year">
          Last Audit&apos;s Fiscal Year
        </label>
        <span className="usa-hint">The fiscal year of the TIR data audited</span>
        <select
          className="usa-select"
          id="last-audit-fiscal-year"
          data-testid="last-audit-fiscal-year"
          value={form.lastAuditFiscalYear}
          onChange={(ev) => {
            const val = ev.target.value;
            setForm((prev) => ({ ...prev, lastAuditFiscalYear: val ? Number(val) : '' }));
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

      <DatePicker
        id="past-field-exam"
        label="Field Exam Report Date"
        value={form.pastFieldExam}
        onChange={handleDateChange('pastFieldExam')}
        onValidationChange={(hasError) => registerFieldError('past-field-exam', hasError)}
        disableMax
      />

      <div className="exam-audit-group">
        <p className="usa-label">Field Exam/Audit Completion Status for Year</p>
        <div className="exam-audit-group__row">
          <div className="usa-form-group">
            <label className="usa-hint" htmlFor="audit-completion-status-year">
              Year
            </label>
            <select
              className="usa-select"
              id="audit-completion-status-year"
              data-testid="audit-completion-status-year"
              value={form.auditCompletionYear}
              onChange={(e) => {
                const val = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  auditCompletionYear: val ? Number(val) : '',
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
            <label className="usa-hint" htmlFor="audit-completion-status-status">
              Status
            </label>
            <select
              className="usa-select"
              id="audit-completion-status-status"
              data-testid="audit-completion-status-status"
              value={form.auditCompletionStatus}
              onChange={(e) => {
                setForm((prev) => ({
                  ...prev,
                  auditCompletionStatus: e.target.value as AuditCompletionStatus | '',
                }));
              }}
            >
              <option value="">- Select -</option>
              <option value="CLOSED">Closed</option>
              <option value="NOT_CLOSED">Not Closed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="usa-button-group">
        <Button
          id="save-chapter7-panel-audit-field-exam"
          data-testid="button-save-chapter7-panel-audit-field-exam"
          onClick={handleSave}
          disabled={isSaving || hasAnyDateError}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id="cancel-chapter7-panel-audit-field-exam"
          data-testid="button-cancel-chapter7-panel-audit-field-exam"
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
