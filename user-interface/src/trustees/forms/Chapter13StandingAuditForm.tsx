import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
} from '@common/cams/trustee-upcoming-key-dates';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import DatePicker from '@/lib/components/uswds/DatePicker';
import useDateFieldErrors from '@/lib/hooks/UseDateFieldErrors';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import { Stop } from '@/lib/components/Stop';

const currentYear = new Date().getFullYear();
const COMPLETION_YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => currentYear - i);

type FormState = {
  pastAudit: string;
  auditCompletionYear: number | '';
  auditCompletionStatus: 'Complete' | 'Incomplete' | '';
};

const EMPTY_FORM: FormState = {
  pastAudit: '',
  auditCompletionYear: '',
  auditCompletionStatus: '',
};

function buildFormStateFromData(data: TrusteeUpcomingKeyDates): FormState {
  return {
    pastAudit: data.pastAudit ?? '',
    auditCompletionYear: data.auditCompletionYear ?? '',
    auditCompletionStatus: data.auditCompletionStatus ?? '',
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
    auditCompletionYear: form.auditCompletionYear || null,
    auditCompletionStatus: form.auditCompletionStatus || null,
    tprCompletionYear: original?.tprCompletionYear ?? null,
    tprCompletionStatus: original?.tprCompletionStatus ?? null,
  };
}

export default function Chapter13StandingAuditForm() {
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

  useEffect(() => {
    Api2.getUpcomingKeyDates(trusteeId!, appointmentId!)
      .then((response) => {
        setOriginal(response.data);
        if (response.data) {
          setForm(buildFormStateFromData(response.data));
        }
      })
      .catch((err) => {
        globalAlert?.error(`Failed to load Audit key dates: ${(err as Error).message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trusteeId, appointmentId]);

  function handleCancel() {
    navigate(`/trustees/${trusteeId}/appointments`);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const input = buildInput(trusteeId!, appointmentId!, original, form);
      await Api2.putUpcomingKeyDates(trusteeId!, appointmentId!, input);
      navigate(`/trustees/${trusteeId}/appointments`);
    } catch (err) {
      globalAlert?.error(`Failed to save Audit key dates: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <LoadingSpinner id="edit-chapter13-standing-audit-key-dates-loading" />;
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

  const isCompletionPairIncomplete =
    (!!form.auditCompletionYear && !form.auditCompletionStatus) ||
    (!form.auditCompletionYear && !!form.auditCompletionStatus);

  const isSaveDisabled = isSaving || hasErrorAmong(['past-audit']) || isCompletionPairIncomplete;

  return (
    <div
      className="edit-chapter13-standing-audit-key-dates"
      data-testid="edit-chapter13-standing-audit-key-dates"
    >
      <h3>Edit Audit Key Dates</h3>
      <DatePicker
        id="past-audit"
        label="Audit Report Date"
        value={form.pastAudit}
        disableMax
        onChange={(e) => setForm((prev) => ({ ...prev, pastAudit: e.target.value }))}
        onValidationChange={(hasError) => registerFieldError('past-audit', hasError)}
      />
      <div className="audit-completion-status-group">
        <p className="usa-label">Audit Completion Status for Year</p>
        <div className="audit-completion-status-group__row">
          <div className="usa-form-group">
            <label className="usa-hint" htmlFor="audit-completion-year">
              Year
            </label>
            <select
              className="usa-select"
              id="audit-completion-year"
              data-testid="audit-completion-year"
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
              {COMPLETION_YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="usa-form-group">
            <label className="usa-hint" htmlFor="audit-completion-status">
              Status
            </label>
            <select
              className="usa-select"
              id="audit-completion-status"
              data-testid="audit-completion-status"
              value={form.auditCompletionStatus}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  auditCompletionStatus: e.target.value as 'Complete' | 'Incomplete' | '',
                }))
              }
            >
              <option value="">- Select -</option>
              <option value="Complete">Complete</option>
              <option value="Incomplete">Incomplete</option>
            </select>
          </div>
        </div>
      </div>
      <div className="usa-button-group">
        <Button
          id="save-chapter13-standing-audit-key-dates"
          onClick={handleSave}
          disabled={isSaveDisabled}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id="cancel-chapter13-standing-audit-key-dates"
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
