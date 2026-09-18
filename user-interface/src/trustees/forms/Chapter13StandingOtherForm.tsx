import './Chapter13StandingOtherForm.scss';
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
import MonthYearSelector from '@/lib/components/uswds/MonthYearSelector';
import useDateFieldErrors from '@/lib/hooks/UseDateFieldErrors';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import { Stop } from '@/lib/components/Stop';

type FormState = {
  leaseExpiration: string;
  pastBackgroundQuestion: string;
  idExpiration: string;
  lastCompensationStudy: string;
};

const EMPTY_FORM: FormState = {
  leaseExpiration: '',
  pastBackgroundQuestion: '',
  idExpiration: '',
  lastCompensationStudy: '',
};

function buildFormStateFromData(data: TrusteeUpcomingKeyDates): FormState {
  return {
    leaseExpiration: data.leaseExpiration ?? '',
    pastBackgroundQuestion: data.pastBackgroundQuestion ?? '',
    idExpiration: data.idExpiration ?? '',
    lastCompensationStudy: data.lastCompensationStudy ?? '',
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
    pastBackgroundQuestion: form.pastBackgroundQuestion || null,
    pastFieldExam: original?.pastFieldExam ?? null,
    pastAudit: original?.pastAudit ?? null,
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
    leaseExpiration: form.leaseExpiration || null,
    idExpiration: form.idExpiration || null,
    lastCompensationStudy: form.lastCompensationStudy || null,
    bondIssuedDate: original?.bondIssuedDate ?? null,
    bondRenewalDate: original?.bondRenewalDate ?? null,
    auditCompletionYear: original?.auditCompletionYear ?? null,
    auditCompletionStatus: original?.auditCompletionStatus ?? null,
    tprCompletionYear: original?.tprCompletionYear ?? null,
    tprCompletionStatus: original?.tprCompletionStatus ?? null,
  };
}

export default function Chapter13StandingOtherForm() {
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
        globalAlert?.error(`Failed to load Other key dates: ${(err as Error).message}`);
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
      globalAlert?.error(`Failed to save Other key dates: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <LoadingSpinner id="edit-chapter13-standing-other-key-dates-loading" />;
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

  const isSaveDisabled =
    isSaving || hasErrorAmong(['lease-expiration', 'past-background-question', 'id-expiration']);

  return (
    <div
      className="edit-chapter13-standing-other-key-dates"
      data-testid="edit-chapter13-standing-other-key-dates"
    >
      <h3>Edit Other Key Dates</h3>
      <DatePicker
        id="lease-expiration"
        label="Lease Expiration"
        value={form.leaseExpiration}
        disableMax
        onChange={(e) => setForm((prev) => ({ ...prev, leaseExpiration: e.target.value }))}
        onValidationChange={(hasError) => registerFieldError('lease-expiration', hasError)}
      />
      <DatePicker
        id="past-background-question"
        label="Last Update to Background Questionnaire"
        value={form.pastBackgroundQuestion}
        disableMax
        onChange={(e) => setForm((prev) => ({ ...prev, pastBackgroundQuestion: e.target.value }))}
        onValidationChange={(hasError) => registerFieldError('past-background-question', hasError)}
      />
      <DatePicker
        id="id-expiration"
        label="ID Expiration"
        value={form.idExpiration}
        disableMax
        onChange={(e) => setForm((prev) => ({ ...prev, idExpiration: e.target.value }))}
        onValidationChange={(hasError) => registerFieldError('id-expiration', hasError)}
      />
      <MonthYearSelector
        id="last-compensation-study"
        label="Last Compensation Study"
        value={form.lastCompensationStudy}
        onChange={(val) => setForm((prev) => ({ ...prev, lastCompensationStudy: val }))}
        onValidationChange={(hasError) => registerFieldError('last-compensation-study', hasError)}
      />
      <div className="usa-button-group">
        <Button
          id="save-chapter13-standing-other-key-dates"
          onClick={handleSave}
          disabled={isSaveDisabled}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id="cancel-chapter13-standing-other-key-dates"
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
