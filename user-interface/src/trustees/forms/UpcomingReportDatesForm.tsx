import './EditUpcomingReportDates.scss';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { InputRef } from '@/lib/type-declarations/input-fields';
import {
  TrusteeUpcomingReportDatesInput,
  validateTrusteeUpcomingReportDates,
  calculateTirSubmission,
  calculateTirReview,
} from '@common/cams/trustee-upcoming-report-dates';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import DatePicker from '@/lib/components/uswds/DatePicker';
import MonthDayRangeSelector from '@/lib/components/uswds/MonthDayRangeSelector';

// ISO date with sentinel year 1900 for month/day-only fields
const MMDD_MIN = '1900-01-01';

function toSentinelDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `1900-${month}-${day}`;
}

function toMonthYearDate(isoDate: string): string {
  const [year, month] = isoDate.split('-');
  return `${year}-${month}-01`;
}

type FormState = {
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
  nextFieldExam: string;
  nextIndependentAuditRequired: string;
};

const EMPTY_FORM: FormState = {
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
  nextFieldExam: '',
  nextIndependentAuditRequired: '',
};

export default function UpcomingReportDatesForm() {
  const { trusteeId, appointmentId } = useParams<{
    trusteeId: string;
    appointmentId: string;
  }>();
  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();

  const tirSubmissionRef = useRef<InputRef>(null);
  const tirReviewRef = useRef<InputRef>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState({
    tprReviewPeriodStart: '',
    tprReviewPeriodEnd: '',
    tirReviewPeriodStart: '',
    tirReviewPeriodEnd: '',
  });
  const [validationState, setValidationState] = useState({
    tprReviewPeriod: true,
    tirReviewPeriod: true,
  });

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
            nextFieldExam: data.nextFieldExam ?? '',
            nextIndependentAuditRequired: data.nextIndependentAuditRequired ?? '',
          });
        }
      })
      .catch((err) => {
        globalAlert?.error(`Failed to load upcoming report dates: ${(err as Error).message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [trusteeId, appointmentId]);

  function handleChange(field: keyof FormState) {
    return (ev: React.ChangeEvent<HTMLInputElement>) => {
      const value = ev.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };
  }

  function handleMonthDayChange(field: keyof FormState) {
    return (value: string) => {
      setSubmitted(false);
      if (field === 'tirReviewPeriodEnd') {
        const submission = value ? calculateTirSubmission(value) : form.tirSubmission;
        const review = value ? calculateTirReview(submission) : form.tirReview;
        tirSubmissionRef.current?.setValue(submission);
        tirReviewRef.current?.setValue(review);
        setForm((prev) => ({
          ...prev,
          tirReviewPeriodEnd: value,
          tirSubmission: submission,
          tirReview: review,
        }));
      } else {
        setForm((prev) => ({ ...prev, [field]: value }));
      }
      if (field in errors) {
        setErrors((prev) => ({ ...prev, [field]: '' }));
      }
    };
  }

  async function handleSave() {
    setSubmitted(true);

    // Check validation state from MonthDayRangeSelectors
    if (!validationState.tprReviewPeriod || !validationState.tirReviewPeriod) {
      return; // Errors are already shown by the components
    }

    const isoInput: TrusteeUpcomingReportDatesInput = {
      trusteeId: trusteeId!,
      appointmentId: appointmentId!,
      fieldExam: form.fieldExam || null,
      audit: form.audit || null,
      tprReviewPeriodStart: form.tprReviewPeriodStart
        ? toSentinelDate(form.tprReviewPeriodStart)
        : null,
      tprReviewPeriodEnd: form.tprReviewPeriodEnd ? toSentinelDate(form.tprReviewPeriodEnd) : null,
      tprDue: form.tprDue ? toMonthYearDate(form.tprDue) : null,
      tprDueYearParity: form.tprDueYearParity || null,
      tirReviewPeriodStart: form.tirReviewPeriodStart
        ? toSentinelDate(form.tirReviewPeriodStart)
        : null,
      tirReviewPeriodEnd: form.tirReviewPeriodEnd ? toSentinelDate(form.tirReviewPeriodEnd) : null,
      tirSubmission: form.tirSubmission ? toSentinelDate(form.tirSubmission) : null,
      tirReview: form.tirReview ? toSentinelDate(form.tirReview) : null,
      nextFieldExam: form.nextFieldExam || null,
      nextIndependentAuditRequired: form.nextIndependentAuditRequired || null,
    };

    const result = validateTrusteeUpcomingReportDates(isoInput);
    setErrors({
      tprReviewPeriodStart: result.reasonMap?.tprReviewPeriodStart?.reasons?.[0] ?? '',
      tprReviewPeriodEnd: result.reasonMap?.tprReviewPeriodEnd?.reasons?.[0] ?? '',
      tirReviewPeriodStart: result.reasonMap?.tirReviewPeriodStart?.reasons?.[0] ?? '',
      tirReviewPeriodEnd: result.reasonMap?.tirReviewPeriodEnd?.reasons?.[0] ?? '',
    });
    if (!result.valid) return;

    setIsSaving(true);
    try {
      await Api2.putUpcomingReportDates(trusteeId!, appointmentId!, isoInput);
      navigate(`/trustees/${trusteeId}/appointments`);
    } catch (err) {
      globalAlert?.error(`Failed to save upcoming report dates: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    navigate(`/trustees/${trusteeId}/appointments`);
  }

  if (isLoading) {
    return <LoadingSpinner id="edit-upcoming-report-dates-loading" />;
  }

  return (
    <div className="edit-upcoming-report-dates" data-testid="edit-upcoming-report-dates">
      <h3>Edit Upcoming Report Dates</h3>
      <DatePicker
        id="field-exam"
        label="Field Exam"
        value={form.nextFieldExam}
        onChange={handleChange('nextFieldExam')}
        disableMax
      />
      <DatePicker
        id="audit"
        label="Audit"
        value={form.nextIndependentAuditRequired}
        onChange={handleChange('nextIndependentAuditRequired')}
        disableMax
      />
      <MonthDayRangeSelector
        id="tpr-review-period"
        label="TPR Review Period"
        startValue={form.tprReviewPeriodStart}
        endValue={form.tprReviewPeriodEnd}
        onStartChange={handleMonthDayChange('tprReviewPeriodStart')}
        onEndChange={handleMonthDayChange('tprReviewPeriodEnd')}
        onValidationChange={(isValid) =>
          setValidationState((prev) => ({ ...prev, tprReviewPeriod: isValid }))
        }
        externalError={errors.tprReviewPeriodStart || errors.tprReviewPeriodEnd}
        submitted={submitted}
      />
      <DatePicker
        id="tpr-due"
        label="TPR Due"
        value={form.tprDue}
        onChange={handleChange('tprDue')}
        disableMax
      />
      <div className="usa-form-group">
        <label className="usa-label" htmlFor="tpr-due-year-qualifier">
          Year Qualifier
        </label>
        <select
          className="usa-select"
          id="tpr-due-year-qualifier"
          data-testid="tpr-due-year-qualifier"
          value={form.tprDueYearParity}
          onChange={(e) => setForm((prev) => ({ ...prev, tprDueYearParity: e.target.value }))}
        >
          <option value="">- Select -</option>
          <option value="EVEN">EVEN</option>
          <option value="ODD">ODD</option>
        </select>
      </div>
      <MonthDayRangeSelector
        id="tir-review-period"
        label="TIR Review Period"
        startValue={form.tirReviewPeriodStart}
        endValue={form.tirReviewPeriodEnd}
        onStartChange={handleMonthDayChange('tirReviewPeriodStart')}
        onEndChange={handleMonthDayChange('tirReviewPeriodEnd')}
        onValidationChange={(isValid) =>
          setValidationState((prev) => ({ ...prev, tirReviewPeriod: isValid }))
        }
        externalError={errors.tirReviewPeriodStart || errors.tirReviewPeriodEnd}
        submitted={submitted}
      />
      <DatePicker
        ref={tirSubmissionRef}
        id="tir-submission"
        label="TIR Submission"
        min={MMDD_MIN}
        value={form.tirSubmission}
        onChange={handleChange('tirSubmission')}
        disableMax
      />
      <DatePicker
        ref={tirReviewRef}
        id="tir-review"
        label="TIR Review"
        min={MMDD_MIN}
        value={form.tirReview}
        onChange={handleChange('tirReview')}
        disableMax
      />
      <div className="usa-button-group">
        <Button id="save-upcoming-report-dates" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id="cancel-upcoming-report-dates"
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
