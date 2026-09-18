import './EditUpcomingKeyDates.scss';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
  calculateTirSubmission,
  calculateTirReview,
  isoToMMDD,
} from '@common/cams/trustee-upcoming-key-dates';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { Stop } from '@/lib/components/Stop';

const CURRENT_YEAR = new Date().getFullYear();
const FISCAL_YEAR_OPTIONS = Array.from({ length: 21 }, (_, i) => CURRENT_YEAR - i);
const NO_DATE = 'No date added';

type TirFrequency = 'ANNUAL' | 'SEMI_ANNUAL' | '';
type TirCompletionStatus = 'COMPLETE' | 'INCOMPLETE';

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

type Chapter7PanelTrusteeInterimReportFormState = {
  tirFrequency: TirFrequency;
  tirPeriodKey: string;
  tirReviewPeriodStart: string;
  tirReviewPeriodEnd: string;
  tirSemiAnnualReviewPeriodStart: string;
  tirSemiAnnualReviewPeriodEnd: string;
  tirCompletionYear: number | '';
  tirCompletionStatus: TirCompletionStatus | '';
};

const EMPTY_FORM: Chapter7PanelTrusteeInterimReportFormState = {
  tirFrequency: '',
  tirPeriodKey: '',
  tirReviewPeriodStart: '',
  tirReviewPeriodEnd: '',
  tirSemiAnnualReviewPeriodStart: '',
  tirSemiAnnualReviewPeriodEnd: '',
  tirCompletionYear: '',
  tirCompletionStatus: '',
};

function calculateSubmissionAndReview(form: Chapter7PanelTrusteeInterimReportFormState) {
  let tirSubmission: string | null = null;
  let tirReview: string | null = null;
  let tirSemiAnnualSubmission: string | null = null;
  let tirSemiAnnualReview: string | null = null;

  if (form.tirReviewPeriodEnd) {
    tirSubmission = calculateTirSubmission(form.tirReviewPeriodEnd);
    tirReview = calculateTirReview(tirSubmission);
  }

  if (form.tirFrequency === 'SEMI_ANNUAL' && form.tirSemiAnnualReviewPeriodEnd) {
    tirSemiAnnualSubmission = calculateTirSubmission(form.tirSemiAnnualReviewPeriodEnd);
    tirSemiAnnualReview = calculateTirReview(tirSemiAnnualSubmission);
  }

  return { tirSubmission, tirReview, tirSemiAnnualSubmission, tirSemiAnnualReview };
}

export function buildTrusteeInterimReportKeyDatesInput(
  ids: { trusteeId: string; appointmentId: string },
  original: TrusteeUpcomingKeyDates | null,
  form: Chapter7PanelTrusteeInterimReportFormState,
): TrusteeUpcomingKeyDatesInput {
  const { tirSubmission, tirReview, tirSemiAnnualSubmission, tirSemiAnnualReview } =
    calculateSubmissionAndReview(form);

  return {
    trusteeId: ids.trusteeId,
    appointmentId: ids.appointmentId,
    pastBackgroundQuestion: original?.pastBackgroundQuestion ?? null,
    pastFieldExam: original?.pastFieldExam ?? null,
    pastAudit: original?.pastAudit ?? null,
    pastTprSubmission: original?.pastTprSubmission ?? null,
    lastTprSubmitted: original?.lastTprSubmitted ?? null,
    tprReviewPeriodStart: original?.tprReviewPeriodStart ?? null,
    tprReviewPeriodEnd: original?.tprReviewPeriodEnd ?? null,
    tprDue: original?.tprDue ?? null,
    tprDueYearType: original?.tprDueYearType ?? null,
    tprFrequency: original?.tprFrequency ?? null,
    tirReviewPeriodStart: form.tirReviewPeriodStart || null,
    tirReviewPeriodEnd: form.tirReviewPeriodEnd || null,
    tirSubmission,
    tirReview,
    upcomingExamOrAuditYear: original?.upcomingExamOrAuditYear ?? null,
    upcomingExamOrAuditType: original?.upcomingExamOrAuditType ?? null,
    tirFrequency: form.tirFrequency || null,
    tirSemiAnnualReviewPeriodStart:
      form.tirFrequency === 'SEMI_ANNUAL' ? form.tirSemiAnnualReviewPeriodStart || null : null,
    tirSemiAnnualReviewPeriodEnd:
      form.tirFrequency === 'SEMI_ANNUAL' ? form.tirSemiAnnualReviewPeriodEnd || null : null,
    tirSemiAnnualSubmission,
    tirSemiAnnualReview,
    lastAuditFiscalYear: original?.lastAuditFiscalYear ?? null,
    auditCompletionYear: original?.auditCompletionYear ?? null,
    auditCompletionStatus: original?.auditCompletionStatus ?? null,
    tprCompletionYear: original?.tprCompletionYear ?? null,
    tprCompletionStatus: original?.tprCompletionStatus ?? null,
    tirCompletionYear: form.tirCompletionYear !== '' ? form.tirCompletionYear : null,
    tirCompletionStatus: form.tirCompletionStatus || null,
    lastMonthlyReportReceived: original?.lastMonthlyReportReceived ?? null,
    leaseExpiration: original?.leaseExpiration ?? null,
    idExpiration: original?.idExpiration ?? null,
    lastCompensationStudy: original?.lastCompensationStudy ?? null,
    bondIssuedDate: original?.bondIssuedDate ?? null,
    bondRenewalDate: original?.bondRenewalDate ?? null,
  };
}

function formatCalculatedDate(primary: string | null, secondary: string | null): string {
  if (!primary) return NO_DATE;
  return secondary ? `${isoToMMDD(primary)} & ${isoToMMDD(secondary)}` : isoToMMDD(primary);
}

export default function Chapter7PanelTrusteeInterimReportForm() {
  const { trusteeId, appointmentId } = useParams<{
    trusteeId: string;
    appointmentId: string;
  }>();
  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();
  const canManage = useCanManageTrustees();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<Chapter7PanelTrusteeInterimReportFormState>(EMPTY_FORM);
  const [original, setOriginal] = useState<TrusteeUpcomingKeyDates | null>(null);

  useEffect(() => {
    Api2.getUpcomingKeyDates(trusteeId!, appointmentId!)
      .then((response) => {
        const data = response.data;
        if (data) {
          setOriginal(data);
          const tirFrequency = data.tirFrequency ?? '';
          setForm({
            tirFrequency,
            tirPeriodKey: findPeriodKey(
              data.tirReviewPeriodStart,
              data.tirReviewPeriodEnd,
              tirFrequency,
            ),
            tirReviewPeriodStart: data.tirReviewPeriodStart ?? '',
            tirReviewPeriodEnd: data.tirReviewPeriodEnd ?? '',
            tirSemiAnnualReviewPeriodStart: data.tirSemiAnnualReviewPeriodStart ?? '',
            tirSemiAnnualReviewPeriodEnd: data.tirSemiAnnualReviewPeriodEnd ?? '',
            tirCompletionYear: data.tirCompletionYear ?? '',
            tirCompletionStatus: data.tirCompletionStatus ?? '',
          });
        }
      })
      .catch((err) => {
        globalAlert?.error(
          `Failed to load Trustee Interim Report key dates: ${(err as Error).message}`,
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [trusteeId, appointmentId]);

  function handleFrequencyChange(ev: React.ChangeEvent<HTMLSelectElement>) {
    const freq = ev.target.value as TirFrequency;
    setForm((prev) => ({
      ...prev,
      tirFrequency: freq,
      tirPeriodKey: '',
      tirReviewPeriodStart: '',
      tirReviewPeriodEnd: '',
      tirSemiAnnualReviewPeriodStart: '',
      tirSemiAnnualReviewPeriodEnd: '',
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
        tirSemiAnnualReviewPeriodStart: '',
        tirSemiAnnualReviewPeriodEnd: '',
      }));
      return;
    }
    const allOptions =
      form.tirFrequency === 'ANNUAL'
        ? ANNUAL_OPTIONS
        : form.tirFrequency === 'SEMI_ANNUAL'
          ? SEMI_ANNUAL_OPTIONS
          : [];
    // The DOM's <option> elements are generated from allOptions, so key always
    // resolves to one of them -- there is no "not found" state to guard against.
    const option = allOptions.find((o) => o.key === key)!;
    setForm((prev) => ({
      ...prev,
      tirPeriodKey: key,
      tirReviewPeriodStart: option.start,
      tirReviewPeriodEnd: option.end,
      tirSemiAnnualReviewPeriodStart: option.start2 ?? '',
      tirSemiAnnualReviewPeriodEnd: option.end2 ?? '',
    }));
  }

  async function handleSave() {
    setIsSaving(true);
    const input = buildTrusteeInterimReportKeyDatesInput(
      { trusteeId: trusteeId!, appointmentId: appointmentId! },
      original,
      form,
    );

    try {
      await Api2.putUpcomingKeyDates(trusteeId!, appointmentId!, input);
      navigate(`/trustees/${trusteeId}/appointments`);
    } catch (err) {
      globalAlert?.error(
        `Failed to save Trustee Interim Report key dates: ${(err as Error).message}`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    navigate(`/trustees/${trusteeId}/appointments`);
  }

  if (isLoading) {
    return <LoadingSpinner id="edit-chapter7-panel-tir-loading" />;
  }

  if (!canManage) {
    return (
      <Stop
        id="forbidden-alert"
        title="Forbidden"
        message="You do not have permission to manage Trustee Interim Report Key Dates"
        asError
      />
    );
  }

  const periodOptions = form.tirFrequency === 'ANNUAL' ? ANNUAL_OPTIONS : SEMI_ANNUAL_OPTIONS;
  const { tirSubmission, tirReview, tirSemiAnnualSubmission, tirSemiAnnualReview } =
    calculateSubmissionAndReview(form);

  return (
    <div className="edit-upcoming-key-dates" data-testid="edit-chapter7-panel-tir">
      <h3>Edit Trustee Interim Report Key Dates</h3>

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

      <div className="usa-form-group">
        <p className="usa-label" id="tir-submission-preview-label">
          TIR Submission
        </p>
        <p data-testid="tir-submission-preview">
          {formatCalculatedDate(tirSubmission, tirSemiAnnualSubmission)}
        </p>
      </div>

      <div className="usa-form-group">
        <p className="usa-label" id="tir-due-preview-label">
          TIR Due
        </p>
        <p data-testid="tir-due-preview">{formatCalculatedDate(tirReview, tirSemiAnnualReview)}</p>
      </div>

      <div className="exam-audit-group">
        <p className="usa-label">TIR Completion Status for Year</p>
        <div className="exam-audit-group__row">
          <div className="usa-form-group">
            <label className="usa-hint" htmlFor="tir-completion-status-year">
              Year
            </label>
            <select
              className="usa-select"
              id="tir-completion-status-year"
              data-testid="tir-completion-status-year"
              value={form.tirCompletionYear}
              onChange={(e) => {
                const val = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  tirCompletionYear: val ? Number(val) : '',
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
            <label className="usa-hint" htmlFor="tir-completion-status-status">
              Status
            </label>
            <select
              className="usa-select"
              id="tir-completion-status-status"
              data-testid="tir-completion-status-status"
              value={form.tirCompletionStatus}
              onChange={(e) => {
                setForm((prev) => ({
                  ...prev,
                  tirCompletionStatus: e.target.value as TirCompletionStatus | '',
                }));
              }}
            >
              <option value="">- Select -</option>
              <option value="COMPLETE">Complete</option>
              <option value="INCOMPLETE">Incomplete</option>
            </select>
          </div>
        </div>
      </div>

      <div className="usa-button-group">
        <Button
          id="save-chapter7-panel-tir"
          data-testid="button-save-chapter7-panel-tir"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id="cancel-chapter7-panel-tir"
          data-testid="button-cancel-chapter7-panel-tir"
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
