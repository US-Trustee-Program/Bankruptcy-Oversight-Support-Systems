import './EditUpcomingKeyDates.scss';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
  calculateNextAuditDate,
} from '@common/cams/trustee-upcoming-key-dates';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import DatePicker from '@/lib/components/uswds/DatePicker';

function toSentinelDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `1900-${month}-${day}`;
}

type PastKeyDatesFormState = {
  pastFieldExam: string;
  pastAudit: string;
  upcomingFieldExam: string;
  upcomingIndependentAuditRequired: string;
};

const EMPTY_FORM: PastKeyDatesFormState = {
  pastFieldExam: '',
  pastAudit: '',
  upcomingFieldExam: '',
  upcomingIndependentAuditRequired: '',
};

function computeNextDates(pastFieldExam: string, pastAudit: string) {
  return {
    upcomingFieldExam:
      calculateNextAuditDate(pastFieldExam || undefined, pastAudit || undefined, 3) ?? '',
    upcomingIndependentAuditRequired:
      calculateNextAuditDate(pastFieldExam || undefined, pastAudit || undefined, 6) ?? '',
  };
}

function buildUpcomingKeyDatesInput(
  ids: { trusteeId: string; appointmentId: string },
  original: TrusteeUpcomingKeyDates | null,
  form: PastKeyDatesFormState,
): TrusteeUpcomingKeyDatesInput {
  return {
    trusteeId: ids.trusteeId,
    appointmentId: ids.appointmentId,
    pastFieldExam: form.pastFieldExam || null,
    pastAudit: form.pastAudit || null,
    tprReviewPeriodStart: original?.tprReviewPeriodStart
      ? toSentinelDate(original.tprReviewPeriodStart)
      : null,
    tprReviewPeriodEnd: original?.tprReviewPeriodEnd
      ? toSentinelDate(original.tprReviewPeriodEnd)
      : null,
    tprDue: original?.tprDue ? toSentinelDate(original.tprDue) : null,
    tprDueYearType: original?.tprDueYearType ?? null,
    tirReviewPeriodStart: original?.tirReviewPeriodStart
      ? toSentinelDate(original.tirReviewPeriodStart)
      : null,
    tirReviewPeriodEnd: original?.tirReviewPeriodEnd
      ? toSentinelDate(original.tirReviewPeriodEnd)
      : null,
    tirSubmission: original?.tirSubmission ? toSentinelDate(original.tirSubmission) : null,
    tirReview: original?.tirReview ? toSentinelDate(original.tirReview) : null,
    upcomingFieldExam: form.upcomingFieldExam || null,
    upcomingIndependentAuditRequired: form.upcomingIndependentAuditRequired || null,
  };
}

export default function PastKeyDatesForm() {
  const { trusteeId, appointmentId } = useParams<{
    trusteeId: string;
    appointmentId: string;
  }>();
  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<PastKeyDatesFormState>(EMPTY_FORM);
  const [original, setOriginal] = useState<TrusteeUpcomingKeyDates | null>(null);

  useEffect(() => {
    Api2.getUpcomingKeyDates(trusteeId!, appointmentId!)
      .then((response) => {
        const data = response.data;
        if (data) {
          setOriginal(data);
          setForm({
            pastFieldExam: data.pastFieldExam ?? '',
            pastAudit: data.pastAudit ?? '',
            upcomingFieldExam: data.upcomingFieldExam ?? '',
            upcomingIndependentAuditRequired: data.upcomingIndependentAuditRequired ?? '',
          });
        }
      })
      .catch((err) => {
        globalAlert?.error(`Failed to load past key dates: ${(err as Error).message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [trusteeId, appointmentId]);

  function handleChange(field: 'pastFieldExam' | 'pastAudit') {
    return (ev: React.ChangeEvent<HTMLInputElement>) => {
      const value = ev.target.value;
      const pastFieldExam = field === 'pastFieldExam' ? value : form.pastFieldExam;
      const pastAudit = field === 'pastAudit' ? value : form.pastAudit;
      setForm((prev) => ({
        ...prev,
        [field]: value,
        ...computeNextDates(pastFieldExam, pastAudit),
      }));
    };
  }

  async function handleSave() {
    setIsSaving(true);
    const isoInput = buildUpcomingKeyDatesInput(
      { trusteeId: trusteeId!, appointmentId: appointmentId! },
      original,
      form,
    );

    try {
      await Api2.putUpcomingKeyDates(trusteeId!, appointmentId!, isoInput);
      navigate(`/trustees/${trusteeId}/appointments`);
    } catch (err) {
      globalAlert?.error(`Failed to save past key dates: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    navigate(`/trustees/${trusteeId}/appointments`);
  }

  if (isLoading) {
    return <LoadingSpinner id="edit-past-key-dates-loading" />;
  }

  return (
    <div className="edit-upcoming-key-dates" data-testid="edit-past-key-dates">
      <h3>Edit Past Key Dates</h3>
      <DatePicker
        id="past-field-exam"
        label="Field Exam"
        value={form.pastFieldExam}
        onChange={handleChange('pastFieldExam')}
        disableMax
      />
      <DatePicker
        id="past-audit"
        label="Audit"
        value={form.pastAudit}
        onChange={handleChange('pastAudit')}
        disableMax
      />
      <div className="usa-button-group">
        <Button id="save-past-key-dates" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id="cancel-past-key-dates"
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
