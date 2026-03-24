import './EditUpcomingReportDates.scss';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TrusteeUpcomingReportDatesInput,
  calculateNextAuditDate,
} from '@common/cams/trustee-upcoming-report-dates';
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
  fieldExam: string;
  audit: string;
  tprReviewPeriodStart: string;
  tprReviewPeriodEnd: string;
  tprDue: string;
  tprDueYearParity: string;
  tirReviewPeriodStart: string;
  tirReviewPeriodEnd: string;
  tirSubmission: string;
  tirReview: string;
  upcomingFieldExam: string;
  upcomingIndependentAuditRequired: string;
};

const EMPTY_FORM: FullFormState = {
  fieldExam: '',
  audit: '',
  tprReviewPeriodStart: '',
  tprReviewPeriodEnd: '',
  tprDue: '',
  tprDueYearParity: '',
  tirReviewPeriodStart: '',
  tirReviewPeriodEnd: '',
  tirSubmission: '',
  tirReview: '',
  upcomingFieldExam: '',
  upcomingIndependentAuditRequired: '',
};

export default function PastReportDatesForm() {
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
    Api2.getUpcomingReportDates(trusteeId!, appointmentId!)
      .then((response) => {
        const data = response.data;
        if (data) {
          setForm({
            fieldExam: data.fieldExam ?? '',
            audit: data.audit ?? '',
            tprReviewPeriodStart: data.tprReviewPeriodStart ?? '',
            tprReviewPeriodEnd: data.tprReviewPeriodEnd ?? '',
            tprDue: data.tprDue ?? '',
            tprDueYearParity: data.tprDueYearParity ?? '',
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
        globalAlert?.error(`Failed to load past report dates: ${(err as Error).message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [trusteeId, appointmentId]);

  function handleChange(field: 'fieldExam' | 'audit') {
    return (ev: React.ChangeEvent<HTMLInputElement>) => {
      const value = ev.target.value;
      const fe = field === 'fieldExam' ? value : form.fieldExam;
      const au = field === 'audit' ? value : form.audit;
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

    const isoInput: TrusteeUpcomingReportDatesInput = {
      trusteeId: trusteeId!,
      appointmentId: appointmentId!,
      fieldExam: form.fieldExam || null,
      audit: form.audit || null,
      tprReviewPeriodStart: form.tprReviewPeriodStart
        ? toSentinelDate(form.tprReviewPeriodStart)
        : null,
      tprReviewPeriodEnd: form.tprReviewPeriodEnd ? toSentinelDate(form.tprReviewPeriodEnd) : null,
      tprDue: form.tprDue ? toSentinelDate(form.tprDue) : null,
      tprDueYearParity: form.tprDueYearParity || null,
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
      await Api2.putUpcomingReportDates(trusteeId!, appointmentId!, isoInput);
      navigate(`/trustees/${trusteeId}/appointments`);
    } catch (err) {
      globalAlert?.error(`Failed to save past report dates: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    navigate(`/trustees/${trusteeId}/appointments`);
  }

  if (isLoading) {
    return <LoadingSpinner id="edit-past-report-dates-loading" />;
  }

  return (
    <div className="edit-upcoming-report-dates" data-testid="edit-past-report-dates">
      <h3>Edit Past Report Dates</h3>
      <DatePicker
        id="past-field-exam"
        label="Field Exam"
        value={form.fieldExam}
        onChange={handleChange('fieldExam')}
        disableMax
      />
      <DatePicker
        id="past-audit"
        label="Audit"
        value={form.audit}
        onChange={handleChange('audit')}
        disableMax
      />
      <div className="usa-button-group">
        <Button id="save-past-report-dates" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id="cancel-past-report-dates"
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
