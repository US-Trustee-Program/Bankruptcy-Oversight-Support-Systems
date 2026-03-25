import './EditUpcomingKeyDates.scss';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
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

type FullFormState = {
  pastFieldExam: string;
  pastAudit: string;
  tprReviewPeriodStart: string;
  tprReviewPeriodEnd: string;
  tprDue: string;
  tprDueYearType: string;
  tirReviewPeriodStart: string;
  tirReviewPeriodEnd: string;
  tirSubmission: string;
  tirReview: string;
  upcomingFieldExam: string;
  upcomingIndependentAuditRequired: string;
};

const EMPTY_FORM: FullFormState = {
  pastFieldExam: '',
  pastAudit: '',
  tprReviewPeriodStart: '',
  tprReviewPeriodEnd: '',
  tprDue: '',
  tprDueYearType: '',
  tirReviewPeriodStart: '',
  tirReviewPeriodEnd: '',
  tirSubmission: '',
  tirReview: '',
  upcomingFieldExam: '',
  upcomingIndependentAuditRequired: '',
};

export default function PastKeyDatesForm() {
  const { trusteeId, appointmentId } = useParams<{
    trusteeId: string;
    appointmentId: string;
  }>();
  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<FullFormState>(EMPTY_FORM);

  useEffect(() => {
    Api2.getUpcomingKeyDates(trusteeId!, appointmentId!)
      .then((response) => {
        const data = response.data;
        if (data) {
          setForm({
            pastFieldExam: data.pastFieldExam ?? '',
            pastAudit: data.pastAudit ?? '',
            tprReviewPeriodStart: data.tprReviewPeriodStart ?? '',
            tprReviewPeriodEnd: data.tprReviewPeriodEnd ?? '',
            tprDue: data.tprDue ?? '',
            tprDueYearType: data.tprDueYearType ?? '',
            tirReviewPeriodStart: data.tirReviewPeriodStart ?? '',
            tirReviewPeriodEnd: data.tirReviewPeriodEnd ?? '',
            tirSubmission: data.tirSubmission ?? '',
            tirReview: data.tirReview ?? '',
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
      const fe = field === 'pastFieldExam' ? value : form.pastFieldExam;
      const au = field === 'pastAudit' ? value : form.pastAudit;
      const next = calculateNextAuditDate(fe || undefined, au || undefined, 3) ?? '';
      const nextRequired = calculateNextAuditDate(fe || undefined, au || undefined, 6) ?? '';
      setForm((prev) => ({
        ...prev,
        [field]: value,
        upcomingFieldExam: next,
        upcomingIndependentAuditRequired: nextRequired,
      }));
    };
  }

  async function handleSave() {
    setIsSaving(true);

    const isoInput: TrusteeUpcomingKeyDatesInput = {
      trusteeId: trusteeId!,
      appointmentId: appointmentId!,
      pastFieldExam: form.pastFieldExam || null,
      pastAudit: form.pastAudit || null,
      tprReviewPeriodStart: form.tprReviewPeriodStart
        ? toSentinelDate(form.tprReviewPeriodStart)
        : null,
      tprReviewPeriodEnd: form.tprReviewPeriodEnd ? toSentinelDate(form.tprReviewPeriodEnd) : null,
      tprDue: form.tprDue ? toSentinelDate(form.tprDue) : null,
      tprDueYearType: form.tprDueYearType || null,
      tirReviewPeriodStart: form.tirReviewPeriodStart
        ? toSentinelDate(form.tirReviewPeriodStart)
        : null,
      tirReviewPeriodEnd: form.tirReviewPeriodEnd ? toSentinelDate(form.tirReviewPeriodEnd) : null,
      tirSubmission: form.tirSubmission ? toSentinelDate(form.tirSubmission) : null,
      tirReview: form.tirReview ? toSentinelDate(form.tirReview) : null,
      upcomingFieldExam: form.upcomingFieldExam || null,
      upcomingIndependentAuditRequired: form.upcomingIndependentAuditRequired || null,
    };

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
