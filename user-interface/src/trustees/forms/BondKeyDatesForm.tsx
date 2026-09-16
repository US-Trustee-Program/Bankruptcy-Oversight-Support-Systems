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
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import { Stop } from '@/lib/components/Stop';
import useFeatureFlags, { DISPLAY_CHPT7_ELECTED_ACCORDION } from '@/lib/hooks/UseFeatureFlags';

type BondKeyDatesFormState = {
  bondIssuedDate: string;
  bondRenewalDate: string;
};

const EMPTY_FORM: BondKeyDatesFormState = {
  bondIssuedDate: '',
  bondRenewalDate: '',
};

export function buildBondKeyDatesInput(
  ids: { trusteeId: string; appointmentId: string },
  original: TrusteeUpcomingKeyDates | null,
  form: BondKeyDatesFormState,
): TrusteeUpcomingKeyDatesInput {
  return {
    trusteeId: ids.trusteeId,
    appointmentId: ids.appointmentId,
    pastBackgroundQuestion: original?.pastBackgroundQuestion ?? null,
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
    leaseExpiration: original?.leaseExpiration ?? null,
    idExpiration: original?.idExpiration ?? null,
    lastCompensationStudy: original?.lastCompensationStudy ?? null,
    bondIssuedDate: form.bondIssuedDate || null,
    bondRenewalDate: form.bondRenewalDate || null,
  };
}

export default function BondKeyDatesForm() {
  const { trusteeId, appointmentId } = useParams<{
    trusteeId: string;
    appointmentId: string;
  }>();
  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();
  const canManage = !!LocalStorage.getSession()?.user?.roles?.includes(CamsRole.TrusteeAdmin);
  const featureFlags = useFeatureFlags();
  const displayChpt7ElectedAccordion = featureFlags[DISPLAY_CHPT7_ELECTED_ACCORDION] === true;

  const [isLoading, setIsLoading] = useState(displayChpt7ElectedAccordion);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<BondKeyDatesFormState>(EMPTY_FORM);
  const [original, setOriginal] = useState<TrusteeUpcomingKeyDates | null>(null);
  const { registerFieldError, hasErrorAmong } = useDateFieldErrors();

  useEffect(() => {
    if (!displayChpt7ElectedAccordion) {
      return;
    }
    Api2.getUpcomingKeyDates(trusteeId!, appointmentId!)
      .then((response) => {
        const data = response.data;
        if (data) {
          setOriginal(data);
          setForm({
            bondIssuedDate: data.bondIssuedDate ?? '',
            bondRenewalDate: data.bondRenewalDate ?? '',
          });
        }
      })
      .catch((err) => {
        globalAlert?.error(`Failed to load bond key dates: ${(err as Error).message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [trusteeId, appointmentId, displayChpt7ElectedAccordion]);

  function handleDateChange(field: keyof BondKeyDatesFormState) {
    return (ev: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: ev.target.value }));
    };
  }

  async function handleSave() {
    setIsSaving(true);
    const input = buildBondKeyDatesInput(
      { trusteeId: trusteeId!, appointmentId: appointmentId! },
      original,
      form,
    );

    try {
      await Api2.putUpcomingKeyDates(trusteeId!, appointmentId!, input);
      navigate(`/trustees/${trusteeId}/appointments`);
    } catch (err) {
      globalAlert?.error(`Failed to save bond key dates: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    navigate(`/trustees/${trusteeId}/appointments`);
  }

  if (!displayChpt7ElectedAccordion) {
    return (
      <Stop
        id="chapter7-elected-accordion-disabled-alert"
        title="Moved"
        message="Bond key dates for this appointment are managed from the appointment's Upcoming Key Dates form."
      />
    );
  }

  if (isLoading) {
    return <LoadingSpinner id="edit-bond-key-dates-loading" />;
  }

  if (!canManage) {
    return (
      <Stop
        id="forbidden-alert"
        title="Forbidden"
        message="You do not have permission to manage Trustee Bond Key Dates"
        asError
      />
    );
  }

  const hasAnyDateError = hasErrorAmong(['bond-issued-date', 'bond-renewal-date']);

  return (
    <div className="edit-upcoming-key-dates" data-testid="edit-bond-key-dates">
      <h3>Edit Key Dates</h3>
      <DatePicker
        id="bond-renewal-date"
        label="Bond Renewal Date"
        value={form.bondRenewalDate}
        onChange={handleDateChange('bondRenewalDate')}
        onValidationChange={(hasError) => registerFieldError('bond-renewal-date', hasError)}
        disableMax
      />
      <DatePicker
        id="bond-issued-date"
        label="Bond Issued Date"
        value={form.bondIssuedDate}
        onChange={handleDateChange('bondIssuedDate')}
        onValidationChange={(hasError) => registerFieldError('bond-issued-date', hasError)}
        disableMax
      />
      <div className="usa-button-group">
        <Button
          id="save-bond-key-dates"
          data-testid="button-save-bond-key-dates"
          onClick={handleSave}
          disabled={isSaving || hasAnyDateError}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id="cancel-bond-key-dates"
          data-testid="button-cancel-bond-key-dates"
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
