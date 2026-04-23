import './EditUpcomingKeyDates.scss';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
  isoToSentinel,
} from '@common/cams/trustee-upcoming-key-dates';

const CURRENT_YEAR = new Date().getFullYear();
const FISCAL_YEAR_OPTIONS = Array.from({ length: 21 }, (_, i) => CURRENT_YEAR - i);
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import DatePicker from '@/lib/components/uswds/DatePicker';

type PastKeyDatesFormState = {
  pastBackgroundQuestion: string;
  pastFieldExam: string;
  pastAudit: string;
  pastTprSubmission: string;
  lastAuditFiscalYear: number | '';
};

const EMPTY_FORM: PastKeyDatesFormState = {
  pastBackgroundQuestion: '',
  pastFieldExam: '',
  pastAudit: '',
  pastTprSubmission: '',
  lastAuditFiscalYear: '',
};

function buildUpcomingKeyDatesInput(
  ids: { trusteeId: string; appointmentId: string },
  original: TrusteeUpcomingKeyDates | null,
  form: PastKeyDatesFormState,
): TrusteeUpcomingKeyDatesInput {
  return {
    trusteeId: ids.trusteeId,
    appointmentId: ids.appointmentId,
    pastBackgroundQuestion: form.pastBackgroundQuestion || null,
    pastFieldExam: form.pastFieldExam || null,
    pastAudit: form.pastAudit || null,
    pastTprSubmission: form.pastTprSubmission || null,
    tprReviewPeriodStart: original?.tprReviewPeriodStart
      ? isoToSentinel(original.tprReviewPeriodStart)
      : null,
    tprReviewPeriodEnd: original?.tprReviewPeriodEnd
      ? isoToSentinel(original.tprReviewPeriodEnd)
      : null,
    tprDue: original?.tprDue ? isoToSentinel(original.tprDue) : null,
    tprDueYearType: original?.tprDueYearType ?? null,
    tirReviewPeriodStart: original?.tirReviewPeriodStart
      ? isoToSentinel(original.tirReviewPeriodStart)
      : null,
    tirReviewPeriodEnd: original?.tirReviewPeriodEnd
      ? isoToSentinel(original.tirReviewPeriodEnd)
      : null,
    tirSubmission: original?.tirSubmission ? isoToSentinel(original.tirSubmission) : null,
    tirReview: original?.tirReview ? isoToSentinel(original.tirReview) : null,
    tirReviewPeriodStart2: original?.tirReviewPeriodStart2
      ? isoToSentinel(original.tirReviewPeriodStart2)
      : null,
    tirReviewPeriodEnd2: original?.tirReviewPeriodEnd2
      ? isoToSentinel(original.tirReviewPeriodEnd2)
      : null,
    tirSubmission2: original?.tirSubmission2 ? isoToSentinel(original.tirSubmission2) : null,
    tirReview2: original?.tirReview2 ? isoToSentinel(original.tirReview2) : null,
    upcomingExamOrAuditYear: original?.upcomingExamOrAuditYear ?? null,
    upcomingExamOrAuditType: original?.upcomingExamOrAuditType ?? null,
    tirFrequency: original?.tirFrequency ?? null,
    lastAuditFiscalYear: form.lastAuditFiscalYear || null,
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
            pastBackgroundQuestion: data.pastBackgroundQuestion ?? '',
            pastFieldExam: data.pastFieldExam ?? '',
            pastAudit: data.pastAudit ?? '',
            pastTprSubmission: data.pastTprSubmission ?? '',
            lastAuditFiscalYear: data.lastAuditFiscalYear ?? '',
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

  function handleSimpleChange(field: 'pastBackgroundQuestion' | 'pastTprSubmission') {
    return (ev: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: ev.target.value }));
    };
  }

  function handleChange(field: 'pastFieldExam' | 'pastAudit') {
    return (ev: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: ev.target.value }));
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
        id="past-background-question"
        label="Last Update to Background Questionnaire"
        value={form.pastBackgroundQuestion}
        onChange={handleSimpleChange('pastBackgroundQuestion')}
        disableMax
      />
      <DatePicker
        id="past-field-exam"
        label="Field Exam Report Date"
        value={form.pastFieldExam}
        onChange={handleChange('pastFieldExam')}
        disableMax
      />
      <DatePicker
        id="past-audit"
        label="Audit Report Date"
        value={form.pastAudit}
        onChange={handleChange('pastAudit')}
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
        id="past-tpr-submission"
        label="Trustee Interim Report Letter Date"
        value={form.pastTprSubmission}
        onChange={handleSimpleChange('pastTprSubmission')}
        disableMax
      />
      <div className="usa-button-group">
        <Button
          id="save-past-key-dates"
          data-testid="button-save-past-key-dates"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id="cancel-past-key-dates"
          data-testid="button-cancel-past-key-dates"
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
