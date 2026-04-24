import './EditUpcomingKeyDates.scss';
import { useEffect, useState, type FocusEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDatesInput,
  validateTrusteeUpcomingKeyDates,
  validateTprDuePair,
  calculateTirSubmission,
  calculateTirReview,
  isoToSentinel,
} from '@common/cams/trustee-upcoming-key-dates';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import MonthDayRangeSelector from '@/lib/components/uswds/MonthDayRangeSelector';
import MonthDaySelector from '@/lib/components/uswds/MonthDaySelector';

type TirFrequency = 'ANNUAL' | 'SEMI_ANNUAL' | '';

type TirPeriodOption = {
  key: string;
  label: string;
  start: string;
  end: string;
  start2?: string;
  end2?: string;
};

const ANNUAL_OPTIONS: TirPeriodOption[] = [
  { key: '01/01-12/31', label: '01/01-12/31', start: '1900-01-01', end: '1900-12-31' },
  { key: '04/01-03/31', label: '04/01-03/31', start: '1900-04-01', end: '1900-03-31' },
  { key: '07/01-06/30', label: '07/01-06/30', start: '1900-07-01', end: '1900-06-30' },
  { key: '10/01-09/30', label: '10/01-09/30', start: '1900-10-01', end: '1900-09-30' },
];

const SEMI_ANNUAL_OPTIONS: TirPeriodOption[] = [
  {
    key: '01/01-06/30 & 07/01-12/31',
    label: '01/01-06/30 & 07/01-12/31',
    start: '1900-01-01',
    end: '1900-06-30',
    start2: '1900-07-01',
    end2: '1900-12-31',
  },
  {
    key: '04/01-09/30 & 10/01-03/31',
    label: '04/01-09/30 & 10/01-03/31',
    start: '1900-04-01',
    end: '1900-09-30',
    start2: '1900-10-01',
    end2: '1900-03-31',
  },
  {
    key: '07/01-12/31 & 01/01-06/30',
    label: '07/01-12/31 & 01/01-06/30',
    start: '1900-07-01',
    end: '1900-12-31',
    start2: '1900-01-01',
    end2: '1900-06-30',
  },
  {
    key: '10/01-03/31 & 04/01-09/30',
    label: '10/01-03/31 & 04/01-09/30',
    start: '1900-10-01',
    end: '1900-03-31',
    start2: '1900-04-01',
    end2: '1900-09-30',
  },
];

function findPeriodKey(
  start: string | undefined,
  end: string | undefined,
  frequency: TirFrequency,
): string {
  if (!start || !end) return '';
  const options = frequency === 'ANNUAL' ? ANNUAL_OPTIONS : SEMI_ANNUAL_OPTIONS;
  return options.find((o) => o.start === start && o.end === end)?.key ?? '';
}

type FormState = {
  pastBackgroundQuestion: string;
  pastFieldExam: string;
  pastAudit: string;
  pastTprSubmission: string;
  tprReviewPeriodStart: string;
  tprReviewPeriodEnd: string;
  tprDue: string;
  tprDueYearType: string;
  upcomingExamOrAuditYear: number | '';
  upcomingExamOrAuditType: 'Field Exam' | 'Audit' | '';
  tirFrequency: TirFrequency;
  tirPeriodKey: string;
  tirReviewPeriodStart: string;
  tirReviewPeriodEnd: string;
  tirReviewPeriodStart2: string;
  tirReviewPeriodEnd2: string;
  lastAuditFiscalYear: number | null;
};

const EMPTY_FORM: FormState = {
  pastBackgroundQuestion: '',
  pastFieldExam: '',
  pastAudit: '',
  pastTprSubmission: '',
  tprReviewPeriodStart: '',
  tprReviewPeriodEnd: '',
  tprDue: '',
  tprDueYearType: '',
  upcomingExamOrAuditYear: '',
  upcomingExamOrAuditType: '',
  tirFrequency: '',
  tirPeriodKey: '',
  tirReviewPeriodStart: '',
  tirReviewPeriodEnd: '',
  tirReviewPeriodStart2: '',
  tirReviewPeriodEnd2: '',
  lastAuditFiscalYear: null,
};

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => currentYear + i);

export default function UpcomingKeyDatesForm() {
  const { trusteeId, appointmentId } = useParams<{
    trusteeId: string;
    appointmentId: string;
  }>();
  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState({
    tprReviewPeriodStart: '',
    tprReviewPeriodEnd: '',
    tprDue: '',
    tprDueYearType: '',
  });
  const [validationState, setValidationState] = useState({ tprReviewPeriod: true });
  const [tprDueRowFocused, setTprDueRowFocused] = useState(false);
  const [tprDueRowHasInteracted, setTprDueRowHasInteracted] = useState(false);

  function handleTprDueRowFocus() {
    setTprDueRowFocused(true);
    setTprDueRowHasInteracted(true);
  }

  function handleTprDueRowBlur(e: FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setTprDueRowFocused(false);
    }
  }

  const tprDueBlurError =
    tprDueRowHasInteracted && !tprDueRowFocused
      ? validateTprDuePair(form.tprDue, form.tprDueYearType)
      : '';

  const tprDueDateComplete = (() => {
    const [, m, d] = (form.tprDue || '').split('-');
    return !!(m && d);
  })();
  const tprDueYearTypeBlurError =
    !tprDueRowFocused && tprDueRowHasInteracted && tprDueDateComplete && !form.tprDueYearType;

  useEffect(() => {
    Api2.getUpcomingKeyDates(trusteeId!, appointmentId!)
      .then((response) => {
        const data = response.data;
        if (data) {
          const freq: TirFrequency = data.tirFrequency ?? '';
          const periodKey = findPeriodKey(data.tirReviewPeriodStart, data.tirReviewPeriodEnd, freq);
          setForm({
            pastBackgroundQuestion: data.pastBackgroundQuestion ?? '',
            pastFieldExam: data.pastFieldExam ?? '',
            pastAudit: data.pastAudit ?? '',
            pastTprSubmission: data.pastTprSubmission ?? '',
            tprReviewPeriodStart: data.tprReviewPeriodStart ?? '',
            tprReviewPeriodEnd: data.tprReviewPeriodEnd ?? '',
            tprDue: data.tprDue ?? '',
            tprDueYearType: data.tprDueYearType ?? '',
            upcomingExamOrAuditYear: data.upcomingExamOrAuditYear ?? '',
            upcomingExamOrAuditType: data.upcomingExamOrAuditType ?? '',
            tirFrequency: freq,
            tirPeriodKey: periodKey,
            tirReviewPeriodStart: data.tirReviewPeriodStart ?? '',
            tirReviewPeriodEnd: data.tirReviewPeriodEnd ?? '',
            tirReviewPeriodStart2: data.tirReviewPeriodStart2 ?? '',
            tirReviewPeriodEnd2: data.tirReviewPeriodEnd2 ?? '',
            lastAuditFiscalYear: data.lastAuditFiscalYear ?? null,
          });
        }
      })
      .catch((err) => {
        globalAlert?.error(`Failed to load upcoming key dates: ${(err as Error).message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [trusteeId, appointmentId]);

  function handleMonthDayChange(field: keyof FormState) {
    return (value: string) => {
      setSubmitted(false);
      setForm((prev) => ({ ...prev, [field]: value }));
      if (field === 'tprDue') {
        setErrors((prev) => ({ ...prev, tprDue: '', tprDueYearType: '' }));
      } else if (field in errors) {
        setErrors((prev) => ({ ...prev, [field]: '' }));
      }
    };
  }

  function handleYearTypeChange(ev: React.ChangeEvent<HTMLSelectElement>) {
    setSubmitted(false);
    setForm((prev) => ({ ...prev, tprDueYearType: ev.target.value }));
    setErrors((prev) => ({ ...prev, tprDue: '', tprDueYearType: '' }));
  }

  function handleFrequencyChange(ev: React.ChangeEvent<HTMLSelectElement>) {
    const freq = ev.target.value as TirFrequency;
    setForm((prev) => ({
      ...prev,
      tirFrequency: freq,
      tirPeriodKey: '',
      tirReviewPeriodStart: '',
      tirReviewPeriodEnd: '',
      tirReviewPeriodStart2: '',
      tirReviewPeriodEnd2: '',
    }));
  }

  function handlePeriodChange(ev: React.ChangeEvent<HTMLSelectElement>) {
    const key = ev.target.value;
    if (!key) {
      setForm((prev) => ({
        ...prev,
        tirPeriodKey: '',
        tirReviewPeriodStart: '',
        tirReviewPeriodEnd: '',
        tirReviewPeriodStart2: '',
        tirReviewPeriodEnd2: '',
      }));
      return;
    }
    const allOptions =
      form.tirFrequency === 'ANNUAL'
        ? ANNUAL_OPTIONS
        : form.tirFrequency === 'SEMI_ANNUAL'
          ? SEMI_ANNUAL_OPTIONS
          : [];
    const option = allOptions.find((o) => o.key === key);
    if (option) {
      setForm((prev) => ({
        ...prev,
        tirPeriodKey: key,
        tirReviewPeriodStart: option.start,
        tirReviewPeriodEnd: option.end,
        tirReviewPeriodStart2: option.start2 ?? '',
        tirReviewPeriodEnd2: option.end2 ?? '',
      }));
    }
  }

  async function handleSave() {
    setSubmitted(true);

    let tirSubmission: string | null = null;
    let tirReview: string | null = null;
    let tirSubmission2: string | null = null;
    let tirReview2: string | null = null;

    if (form.tirReviewPeriodEnd) {
      const sub = calculateTirSubmission(form.tirReviewPeriodEnd);
      tirSubmission = sub;
      tirReview = calculateTirReview(sub);
    }

    if (form.tirFrequency === 'SEMI_ANNUAL' && form.tirReviewPeriodEnd2) {
      const sub2 = calculateTirSubmission(form.tirReviewPeriodEnd2);
      tirSubmission2 = sub2;
      tirReview2 = calculateTirReview(sub2);
    }

    const isoInput: TrusteeUpcomingKeyDatesInput = {
      trusteeId: trusteeId!,
      appointmentId: appointmentId!,
      pastBackgroundQuestion: form.pastBackgroundQuestion || null,
      pastFieldExam: form.pastFieldExam || null,
      pastAudit: form.pastAudit || null,
      pastTprSubmission: form.pastTprSubmission || null,
      tprReviewPeriodStart: form.tprReviewPeriodStart
        ? isoToSentinel(form.tprReviewPeriodStart)
        : null,
      tprReviewPeriodEnd: form.tprReviewPeriodEnd ? isoToSentinel(form.tprReviewPeriodEnd) : null,
      tprDue: form.tprDue ? isoToSentinel(form.tprDue) : null,
      tprDueYearType: form.tprDueYearType || null,
      upcomingExamOrAuditYear:
        form.upcomingExamOrAuditYear !== '' ? form.upcomingExamOrAuditYear : null,
      upcomingExamOrAuditType: form.upcomingExamOrAuditType || null,
      tirFrequency: form.tirFrequency || null,
      tirReviewPeriodStart: form.tirReviewPeriodStart || null,
      tirReviewPeriodEnd: form.tirReviewPeriodEnd || null,
      tirSubmission,
      tirReview,
      tirReviewPeriodStart2:
        form.tirFrequency === 'SEMI_ANNUAL' ? form.tirReviewPeriodStart2 || null : null,
      tirReviewPeriodEnd2:
        form.tirFrequency === 'SEMI_ANNUAL' ? form.tirReviewPeriodEnd2 || null : null,
      tirSubmission2,
      tirReview2,
      lastAuditFiscalYear: form.lastAuditFiscalYear,
    };

    const result = validateTrusteeUpcomingKeyDates(isoInput);
    setErrors({
      tprReviewPeriodStart: result.reasonMap?.tprReviewPeriodStart?.reasons?.[0] ?? '',
      tprReviewPeriodEnd: result.reasonMap?.tprReviewPeriodEnd?.reasons?.[0] ?? '',
      tprDue: result.reasonMap?.tprDue?.reasons?.[0] ?? '',
      tprDueYearType: result.reasonMap?.tprDueYearType?.reasons?.[0] ?? '',
    });

    if (!validationState.tprReviewPeriod || !result.valid) {
      return;
    }

    setIsSaving(true);
    try {
      await Api2.putUpcomingKeyDates(trusteeId!, appointmentId!, isoInput);
      navigate(`/trustees/${trusteeId}/appointments`);
    } catch (err) {
      globalAlert?.error(`Failed to save upcoming key dates: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    navigate(`/trustees/${trusteeId}/appointments`);
  }

  const periodOptions =
    form.tirFrequency === 'ANNUAL'
      ? ANNUAL_OPTIONS
      : form.tirFrequency === 'SEMI_ANNUAL'
        ? SEMI_ANNUAL_OPTIONS
        : [];

  if (isLoading) {
    return <LoadingSpinner id="edit-upcoming-key-dates-loading" />;
  }

  return (
    <div className="edit-upcoming-key-dates" data-testid="edit-upcoming-key-dates">
      <h3>Edit Upcoming Key Dates</h3>
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
              {YEAR_OPTIONS.map((y) => (
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
      <MonthDayRangeSelector
        id="tpr-review-period"
        label="Trustee Performance Review (TPR) Period"
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
      <div className="tpr-due-group">
        <div className="tpr-due-group__header">
          <label className="usa-label" htmlFor="tpr-due-month">
            Trustee Performance Review (TPR) Due
          </label>
        </div>
        <div
          className="tpr-due-group__row"
          onFocus={handleTprDueRowFocus}
          onBlur={handleTprDueRowBlur}
        >
          <MonthDaySelector
            id="tpr-due"
            value={form.tprDue}
            onChange={handleMonthDayChange('tprDue')}
            hasError={!!errors.tprDue || (!tprDueDateComplete && !!tprDueBlurError)}
          />
          <div className="usa-form-group year-type-selector">
            <label htmlFor="tpr-due-year-type" className="usa-hint">
              Year Type
            </label>
            <select
              className={`usa-select${errors.tprDueYearType || tprDueYearTypeBlurError ? ' usa-input--error' : ''}`}
              id="tpr-due-year-type"
              data-testid="tpr-due-year-type"
              value={form.tprDueYearType}
              onChange={handleYearTypeChange}
              aria-invalid={errors.tprDueYearType ? 'true' : undefined}
            >
              <option value="">- Select -</option>
              <option value="EVEN">EVEN</option>
              <option value="ODD">ODD</option>
            </select>
          </div>
        </div>
        {(tprDueBlurError || errors.tprDue || errors.tprDueYearType) && (
          <span className="usa-error-message" data-testid="tpr-due-error">
            {tprDueBlurError || errors.tprDue || errors.tprDueYearType}
          </span>
        )}
      </div>
      <div className="tir-period-group">
        <p className="usa-label">Trustee Interim Report (TIR) Period</p>
        <div className="tir-period-group__row">
          <div className="usa-form-group">
            <label className="usa-hint" htmlFor="tir-frequency">
              Frequency
            </label>
            <select
              className="usa-select"
              id="tir-frequency"
              data-testid="tir-frequency"
              value={form.tirFrequency}
              onChange={handleFrequencyChange}
            >
              <option value="">- Select -</option>
              <option value="ANNUAL">Annual</option>
              <option value="SEMI_ANNUAL">Semi-Annual</option>
            </select>
          </div>
          <div className="usa-form-group">
            <label className="usa-hint" htmlFor="tir-period">
              Period
            </label>
            <select
              className="usa-select"
              id="tir-period"
              data-testid="tir-period"
              value={form.tirPeriodKey}
              onChange={handlePeriodChange}
              disabled={!form.tirFrequency}
            >
              <option value="">- Select -</option>
              {periodOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="usa-button-group">
        <Button id="save-upcoming-key-dates" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id="cancel-upcoming-key-dates"
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
