import './EditUpcomingKeyDates.scss';
import './EditKeyDatesV2Form.scss';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
  CompletionStatus,
  TprFrequency,
  calculateTirSubmission,
  calculateTirReview,
} from '@common/cams/trustee-upcoming-key-dates';
import Api2 from '@/lib/models/api2';
import DatePicker from '@/lib/components/uswds/DatePicker';
import MonthDaySelector from '@/lib/components/uswds/MonthDaySelector';
import MonthYearSelector from '@/lib/components/uswds/MonthYearSelector';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import { Stop } from '@/lib/components/Stop';

type SectionKey = 'audit' | 'tpr' | 'tir' | 'annual-report' | 'other';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR + 2 - i);
const FISCAL_YEAR_OPTIONS = Array.from({ length: 21 }, (_, i) => CURRENT_YEAR - i);

type TirPeriodOption = {
  value: string;
  label: string;
  start: string;
  end: string;
  semiStart?: string;
  semiEnd?: string;
};

const ANNUAL_PERIOD_OPTIONS: TirPeriodOption[] = [
  { value: 'jan-dec', label: 'Jan 1 - Dec 31', start: '1900-01-01', end: '1900-12-31' },
];

const SEMI_ANNUAL_PERIOD_OPTIONS: TirPeriodOption[] = [
  {
    value: 'h1-h2',
    label: 'Jan 1 - Jun 30 / Jul 1 - Dec 31',
    start: '1900-01-01',
    end: '1900-06-30',
    semiStart: '1900-07-01',
    semiEnd: '1900-12-31',
  },
  {
    value: 'q2-q4',
    label: 'Apr 1 - Sep 30 / Oct 1 - Mar 31',
    start: '1900-04-01',
    end: '1900-09-30',
    semiStart: '1900-10-01',
    semiEnd: '1900-03-31',
  },
];

function deriveTirPeriodKey(data: TrusteeUpcomingKeyDates | null): string {
  if (!data?.tirReviewPeriodStart || !data?.tirReviewPeriodEnd) return '';
  const all = [...ANNUAL_PERIOD_OPTIONS, ...SEMI_ANNUAL_PERIOD_OPTIONS];
  const match = all.find(
    (o) =>
      o.start === data.tirReviewPeriodStart &&
      o.end === data.tirReviewPeriodEnd,
  );
  return match?.value ?? '';
}

// ── Audit form ─────────────────────────────────────────────────────────────

type AuditForm = {
  upcomingExamOrAuditYear: number | '';
  upcomingExamOrAuditType: 'Field Exam' | 'Audit' | '';
  pastAudit: string;
  lastAuditFiscalYear: number | '';
  pastFieldExam: string;
  auditCompletionYear: number | '';
  auditCompletionStatus: CompletionStatus | '';
};

const EMPTY_AUDIT: AuditForm = {
  upcomingExamOrAuditYear: '',
  upcomingExamOrAuditType: '',
  pastAudit: '',
  lastAuditFiscalYear: '',
  pastFieldExam: '',
  auditCompletionYear: '',
  auditCompletionStatus: '',
};

function initAudit(data: TrusteeUpcomingKeyDates | null): AuditForm {
  return {
    upcomingExamOrAuditYear: data?.upcomingExamOrAuditYear ?? '',
    upcomingExamOrAuditType: data?.upcomingExamOrAuditType ?? '',
    pastAudit: data?.pastAudit ?? '',
    lastAuditFiscalYear: data?.lastAuditFiscalYear ?? '',
    pastFieldExam: data?.pastFieldExam ?? '',
    auditCompletionYear: data?.auditCompletionYear ?? '',
    auditCompletionStatus: data?.auditCompletionStatus ?? '',
  };
}

function AuditSection({
  form,
  setForm,
  isChapter12,
  isChapter13Standing,
}: {
  form: AuditForm;
  setForm: React.Dispatch<React.SetStateAction<AuditForm>>;
  isChapter12: boolean;
  isChapter13Standing: boolean;
}) {
  return (
    <>
      <h3>{isChapter12 ? 'Edit Audit Key Dates' : 'Edit Audit/Field Exam Key Dates'}</h3>

      {!isChapter12 && (
        <div className="usa-form-group edit-kd-v2-inline-group">
          <span className="usa-label">Field Exam or Audit</span>
          <div className="edit-kd-v2-inline-row">
            <div>
              <label className="usa-hint" htmlFor="exam-audit-year">Year</label>
              <select
                className="usa-select"
                id="exam-audit-year"
                value={form.upcomingExamOrAuditYear}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    upcomingExamOrAuditYear: e.target.value ? Number(e.target.value) : '',
                  }))
                }
              >
                <option value="">- Select -</option>
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="usa-hint" htmlFor="exam-audit-type">Type</label>
              <select
                className="usa-select"
                id="exam-audit-type"
                value={form.upcomingExamOrAuditType}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    upcomingExamOrAuditType: e.target.value as AuditForm['upcomingExamOrAuditType'],
                  }))
                }
              >
                <option value="">- Select -</option>
                <option value="Audit">Audit</option>
                <option value="Field Exam">Field Exam</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <DatePicker
        id="audit-report-date"
        label="Audit Report Date"
        value={form.pastAudit}
        onChange={(e) => setForm((prev) => ({ ...prev, pastAudit: e.target.value }))}
        disableMax
      />

      {!isChapter13Standing && (
        <div className="usa-form-group">
          <label className="usa-label" htmlFor="last-audit-fiscal-year">
            Last Audit&apos;s Fiscal Year
          </label>
          <span className="usa-hint">The fiscal year of the TIR data audited</span>
          <select
            className="usa-select"
            id="last-audit-fiscal-year"
            value={form.lastAuditFiscalYear}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                lastAuditFiscalYear: e.target.value ? Number(e.target.value) : '',
              }))
            }
          >
            <option value="">- Select -</option>
            {FISCAL_YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      )}

      {!isChapter12 && (
        <DatePicker
          id="field-exam-report-date"
          label="Field Exam Report Date"
          value={form.pastFieldExam}
          onChange={(e) => setForm((prev) => ({ ...prev, pastFieldExam: e.target.value }))}
          disableMax
        />
      )}

      <div className="usa-form-group edit-kd-v2-inline-group">
        <span className="usa-label">{isChapter12 ? 'Audit Completion Status for Year' : 'Field Exam/Audit Completion Status for Year'}</span>
        <div className="edit-kd-v2-inline-row">
          <div>
            <label className="usa-hint" htmlFor="audit-completion-year">Year</label>
            <select
              className="usa-select"
              id="audit-completion-year"
              value={form.auditCompletionYear}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  auditCompletionYear: e.target.value ? Number(e.target.value) : '',
                }))
              }
            >
              <option value="">- Select -</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="usa-hint" htmlFor="audit-completion-status">Status</label>
            <select
              className="usa-select"
              id="audit-completion-status"
              value={form.auditCompletionStatus}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  auditCompletionStatus: e.target.value as CompletionStatus | '',
                }))
              }
            >
              <option value="">- Select -</option>
              <option value="COMPLETE">Complete</option>
              <option value="INCOMPLETE">Incomplete</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
}

// ── TPR form ────────────────────────────────────────────────────────────────

type TprForm = {
  tprReviewPeriodStart: string;
  tprReviewPeriodEnd: string;
  tprFrequency: TprFrequency | '';
  tprDue: string;
  tprDueYearType: string;
  lastTprSubmitted: string;
  tprCompletionYear: number | '';
  tprCompletionStatus: CompletionStatus | '';
};

const EMPTY_TPR: TprForm = {
  tprReviewPeriodStart: '',
  tprReviewPeriodEnd: '',
  tprFrequency: '',
  tprDue: '',
  tprDueYearType: '',
  lastTprSubmitted: '',
  tprCompletionYear: '',
  tprCompletionStatus: '',
};

function initTpr(data: TrusteeUpcomingKeyDates | null): TprForm {
  return {
    tprReviewPeriodStart: data?.tprReviewPeriodStart ?? '',
    tprReviewPeriodEnd: data?.tprReviewPeriodEnd ?? '',
    tprFrequency: data?.tprFrequency ?? '',
    tprDue: data?.tprDue ?? '',
    tprDueYearType: data?.tprDueYearType ?? '',
    lastTprSubmitted: data?.lastTprSubmitted ?? '',
    tprCompletionYear: data?.tprCompletionYear ?? '',
    tprCompletionStatus: data?.tprCompletionStatus ?? '',
  };
}

function TprSection({
  form,
  setForm,
}: {
  form: TprForm;
  setForm: React.Dispatch<React.SetStateAction<TprForm>>;
}) {
  return (
    <>
      <h3>Edit Trustee Performance Report Key Dates</h3>

      <DatePicker
        id="tpr-period-start"
        label="Trustee Performance Review (TPR) Period Start"
        value={form.tprReviewPeriodStart}
        onChange={(e) => setForm((prev) => ({ ...prev, tprReviewPeriodStart: e.target.value }))}
        disableMax
      />

      <DatePicker
        id="tpr-period-end"
        label="Trustee Performance Review (TPR) Period End"
        value={form.tprReviewPeriodEnd}
        onChange={(e) => setForm((prev) => ({ ...prev, tprReviewPeriodEnd: e.target.value }))}
        disableMax
      />

      <div className="usa-form-group">
        <label className="usa-label" htmlFor="tpr-frequency">
          Trustee Performance Review (TPR) Period Frequency
        </label>
        <select
          className="usa-select"
          id="tpr-frequency"
          value={form.tprFrequency}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, tprFrequency: e.target.value as TprFrequency | '' }))
          }
        >
          <option value="">- Select -</option>
          <option value="ANNUAL">Annual</option>
          <option value="BIANNUAL">Biannual</option>
          <option value="SEMI_ANNUAL">Semi-Annual</option>
        </select>
      </div>

      <div className="usa-form-group">
        <span className="usa-label">Trustee Performance Review (TPR) Due</span>
        <div className="edit-kd-v2-tpr-due-row">
          <MonthDaySelector
            id="tpr-due"
            value={form.tprDue}
            onChange={(val) => setForm((prev) => ({ ...prev, tprDue: val }))}
          />
          <div className="usa-form-group edit-kd-v2-year-type">
            <label className="usa-hint" htmlFor="tpr-due-year-type">Year Type</label>
            <select
              className="usa-select"
              id="tpr-due-year-type"
              value={form.tprDueYearType}
              onChange={(e) => setForm((prev) => ({ ...prev, tprDueYearType: e.target.value }))}
            >
              <option value="">- Select -</option>
              <option value="EVEN">Even</option>
              <option value="ODD">Odd</option>
            </select>
          </div>
        </div>
      </div>

      <DatePicker
        id="last-tpr-submitted"
        label="Last Trustee Performance Review (TPR) Submitted"
        value={form.lastTprSubmitted}
        onChange={(e) => setForm((prev) => ({ ...prev, lastTprSubmitted: e.target.value }))}
        disableMax
      />

      <div className="usa-form-group edit-kd-v2-inline-group">
        <span className="usa-label">TPR Completion Status for Year</span>
        <div className="edit-kd-v2-inline-row">
          <div>
            <label className="usa-hint" htmlFor="tpr-completion-year">Year</label>
            <select
              className="usa-select"
              id="tpr-completion-year"
              value={form.tprCompletionYear}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  tprCompletionYear: e.target.value ? Number(e.target.value) : '',
                }))
              }
            >
              <option value="">- Select -</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="usa-hint" htmlFor="tpr-completion-status">Status</label>
            <select
              className="usa-select"
              id="tpr-completion-status"
              value={form.tprCompletionStatus}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  tprCompletionStatus: e.target.value as CompletionStatus | '',
                }))
              }
            >
              <option value="">- Select -</option>
              <option value="COMPLETE">Complete</option>
              <option value="INCOMPLETE">Incomplete</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
}

// ── TIR form ────────────────────────────────────────────────────────────────

type TirForm = {
  tirFrequency: 'ANNUAL' | 'SEMI_ANNUAL' | '';
  tirPeriodKey: string;
  pastTprSubmission: string;
  tirCompletionYear: number | '';
  tirCompletionStatus: CompletionStatus | '';
};

const EMPTY_TIR: TirForm = {
  tirFrequency: '',
  tirPeriodKey: '',
  pastTprSubmission: '',
  tirCompletionYear: '',
  tirCompletionStatus: '',
};

function initTir(data: TrusteeUpcomingKeyDates | null): TirForm {
  return {
    tirFrequency: data?.tirFrequency ?? '',
    tirPeriodKey: deriveTirPeriodKey(data),
    pastTprSubmission: data?.pastTprSubmission ?? '',
    tirCompletionYear: data?.tirCompletionYear ?? '',
    tirCompletionStatus: data?.tirCompletionStatus ?? '',
  };
}

function TirSection({
  form,
  setForm,
}: {
  form: TirForm;
  setForm: React.Dispatch<React.SetStateAction<TirForm>>;
}) {
  const periodOptions =
    form.tirFrequency === 'SEMI_ANNUAL' ? SEMI_ANNUAL_PERIOD_OPTIONS : ANNUAL_PERIOD_OPTIONS;

  return (
    <>
      <h3>Edit Trustee Interim Report Key Dates</h3>

      <div className="usa-form-group edit-kd-v2-inline-group">
        <span className="usa-label">Trustee Interim Report (TIR) Period</span>
        <div className="edit-kd-v2-inline-row">
          <div>
            <label className="usa-hint" htmlFor="tir-frequency">Frequency</label>
            <select
              className="usa-select"
              id="tir-frequency"
              value={form.tirFrequency}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  tirFrequency: e.target.value as TirForm['tirFrequency'],
                  tirPeriodKey: '',
                }))
              }
            >
              <option value="">- Select -</option>
              <option value="ANNUAL">Annual</option>
              <option value="SEMI_ANNUAL">Semi-Annual</option>
            </select>
          </div>
          <div>
            <label className="usa-hint" htmlFor="tir-period">Period</label>
            <select
              className="usa-select"
              id="tir-period"
              value={form.tirPeriodKey}
              disabled={!form.tirFrequency}
              onChange={(e) => setForm((prev) => ({ ...prev, tirPeriodKey: e.target.value }))}
            >
              <option value="">- Select -</option>
              {periodOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <DatePicker
        id="last-tir-letter"
        label="Last Trustee Interim Report Letter"
        value={form.pastTprSubmission}
        onChange={(e) => setForm((prev) => ({ ...prev, pastTprSubmission: e.target.value }))}
        disableMax
      />

      <div className="usa-form-group edit-kd-v2-inline-group">
        <span className="usa-label">TIR Completion Status for Year</span>
        <div className="edit-kd-v2-inline-row">
          <div>
            <label className="usa-hint" htmlFor="tir-completion-year">Year</label>
            <select
              className="usa-select"
              id="tir-completion-year"
              value={form.tirCompletionYear}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  tirCompletionYear: e.target.value ? Number(e.target.value) : '',
                }))
              }
            >
              <option value="">- Select -</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="usa-hint" htmlFor="tir-completion-status">Status</label>
            <select
              className="usa-select"
              id="tir-completion-status"
              value={form.tirCompletionStatus}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  tirCompletionStatus: e.target.value as CompletionStatus | '',
                }))
              }
            >
              <option value="">- Select -</option>
              <option value="COMPLETE">Complete</option>
              <option value="INCOMPLETE">Incomplete</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Budget form ─────────────────────────────────────────────────────────────

type BudgetForm = {
  budgetCompletionYear: number | '';
  budgetCompletionStatus: CompletionStatus | '';
};

const EMPTY_BUDGET: BudgetForm = { budgetCompletionYear: '', budgetCompletionStatus: '' };

function initBudget(data: TrusteeUpcomingKeyDates | null): BudgetForm {
  return {
    budgetCompletionYear: data?.budgetCompletionYear ?? '',
    budgetCompletionStatus: data?.budgetCompletionStatus ?? '',
  };
}

function BudgetSection({
  form,
  setForm,
}: {
  form: BudgetForm;
  setForm: React.Dispatch<React.SetStateAction<BudgetForm>>;
}) {
  return (
    <>
      <h3>Edit Budget Key Dates</h3>
      <div className="usa-form-group edit-kd-v2-inline-group">
        <span className="usa-label">Budget Completion Status for Year</span>
        <div className="edit-kd-v2-inline-row">
          <div>
            <label className="usa-hint" htmlFor="budget-completion-year">Year</label>
            <select
              className="usa-select"
              id="budget-completion-year"
              value={form.budgetCompletionYear}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  budgetCompletionYear: e.target.value ? Number(e.target.value) : '',
                }))
              }
            >
              <option value="">- Select -</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="usa-hint" htmlFor="budget-completion-status">Status</label>
            <select
              className="usa-select"
              id="budget-completion-status"
              value={form.budgetCompletionStatus}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  budgetCompletionStatus: e.target.value as CompletionStatus | '',
                }))
              }
            >
              <option value="">- Select -</option>
              <option value="COMPLETE">Complete</option>
              <option value="INCOMPLETE">Incomplete</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Other form ──────────────────────────────────────────────────────────────

type OtherForm = {
  pastBackgroundQuestion: string;
  leaseExpiration: string;
  idExpiration: string;
  lastMonthlyReportReceived: string;
  lastCompensationStudy: string;
};

const EMPTY_OTHER: OtherForm = { pastBackgroundQuestion: '', leaseExpiration: '', idExpiration: '', lastMonthlyReportReceived: '', lastCompensationStudy: '' };

function initOther(data: TrusteeUpcomingKeyDates | null): OtherForm {
  return {
    pastBackgroundQuestion: data?.pastBackgroundQuestion ?? '',
    leaseExpiration: data?.leaseExpiration ?? '',
    idExpiration: data?.idExpiration ?? '',
    lastMonthlyReportReceived: data?.lastMonthlyReportReceived ?? '',
    lastCompensationStudy: data?.lastCompensationStudy ?? '',
  };
}

function OtherSection({
  form,
  setForm,
  isChapter12,
  isChapter13Standing,
  isSubVPool,
}: {
  form: OtherForm;
  setForm: React.Dispatch<React.SetStateAction<OtherForm>>;
  isChapter12: boolean;
  isChapter13Standing: boolean;
  isSubVPool: boolean;
}) {
  if (isSubVPool) {
    return (
      <>
        <h3>Edit Other Key Dates</h3>
        <DatePicker
          id="last-monthly-report"
          label="Last Monthly Report Received"
          value={form.lastMonthlyReportReceived}
          onChange={(e) => setForm((prev) => ({ ...prev, lastMonthlyReportReceived: e.target.value }))}
          disableMax
        />
      </>
    );
  }

  return (
    <>
      <h3>Edit Other Key Dates</h3>
      {isChapter12 && (
        <DatePicker
          id="lease-expiration"
          label="Lease Expiration"
          value={form.leaseExpiration}
          onChange={(e) => setForm((prev) => ({ ...prev, leaseExpiration: e.target.value }))}
          disableMax
        />
      )}
      <DatePicker
        id="background-question-date"
        label="Last Update to Background Questionnaire"
        value={form.pastBackgroundQuestion}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, pastBackgroundQuestion: e.target.value }))
        }
        disableMax
      />
      {isChapter12 && (
        <DatePicker
          id="id-expiration"
          label="ID Expiration"
          value={form.idExpiration}
          onChange={(e) => setForm((prev) => ({ ...prev, idExpiration: e.target.value }))}
          disableMax
        />
      )}
      {isChapter13Standing && (
        <MonthYearSelector
          id="last-compensation-study"
          label="Last Compensation Study"
          value={form.lastCompensationStudy}
          onChange={(val) => setForm((prev) => ({ ...prev, lastCompensationStudy: val }))}
        />
      )}
    </>
  );
}

// ── Annual Report form ──────────────────────────────────────────────────────

type AnnualReportForm = {
  annualReportCompletionYear: number | '';
  annualReportCompletionStatus: CompletionStatus | '';
};

function initAnnualReport(data: TrusteeUpcomingKeyDates | null): AnnualReportForm {
  return {
    annualReportCompletionYear: data?.annualReportCompletionYear ?? '',
    annualReportCompletionStatus: data?.annualReportCompletionStatus ?? '',
  };
}

function AnnualReportSection({
  form,
  setForm,
}: {
  form: AnnualReportForm;
  setForm: React.Dispatch<React.SetStateAction<AnnualReportForm>>;
}) {
  return (
    <>
      <h3>Edit Annual Report Key Dates</h3>
      <div className="usa-form-group edit-kd-v2-inline-group">
        <span className="usa-label">Annual Report Completion Status for Year</span>
        <div className="edit-kd-v2-inline-row">
          <div>
            <label className="usa-hint" htmlFor="annual-report-completion-year">Year</label>
            <select
              className="usa-select"
              id="annual-report-completion-year"
              value={form.annualReportCompletionYear}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  annualReportCompletionYear: e.target.value ? Number(e.target.value) : '',
                }))
              }
            >
              <option value="">- Select -</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="usa-hint" htmlFor="annual-report-completion-status">Status</label>
            <select
              className="usa-select"
              id="annual-report-completion-status"
              value={form.annualReportCompletionStatus}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  annualReportCompletionStatus: e.target.value as CompletionStatus | '',
                }))
              }
            >
              <option value="">- Select -</option>
              <option value="COMPLETE">Complete</option>
              <option value="INCOMPLETE">Incomplete</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Build save payload ──────────────────────────────────────────────────────

function buildInput(
  trusteeId: string,
  appointmentId: string,
  original: TrusteeUpcomingKeyDates | null,
  section: SectionKey,
  auditForm: AuditForm,
  tprForm: TprForm,
  tirForm: TirForm,
  budgetForm: BudgetForm,
  otherForm: OtherForm,
  annualReportForm: AnnualReportForm,
): TrusteeUpcomingKeyDatesInput {
  const base: TrusteeUpcomingKeyDatesInput = {
    trusteeId,
    appointmentId,
    pastBackgroundQuestion: original?.pastBackgroundQuestion ?? null,
    pastFieldExam: original?.pastFieldExam ?? null,
    pastAudit: original?.pastAudit ?? null,
    pastTprSubmission: original?.pastTprSubmission ?? null,
    tprReviewPeriodStart: original?.tprReviewPeriodStart ?? null,
    tprReviewPeriodEnd: original?.tprReviewPeriodEnd ?? null,
    tprFrequency: original?.tprFrequency ?? null,
    tprDue: original?.tprDue ?? null,
    tprDueYearType: original?.tprDueYearType ?? null,
    lastTprSubmitted: original?.lastTprSubmitted ?? null,
    tprCompletionYear: original?.tprCompletionYear ?? null,
    tprCompletionStatus: original?.tprCompletionStatus ?? null,
    tirReviewPeriodStart: original?.tirReviewPeriodStart ?? null,
    tirReviewPeriodEnd: original?.tirReviewPeriodEnd ?? null,
    tirSubmission: original?.tirSubmission ?? null,
    tirReview: original?.tirReview ?? null,
    tirCompletionYear: original?.tirCompletionYear ?? null,
    tirCompletionStatus: original?.tirCompletionStatus ?? null,
    upcomingExamOrAuditYear: original?.upcomingExamOrAuditYear ?? null,
    upcomingExamOrAuditType: original?.upcomingExamOrAuditType ?? null,
    tirFrequency: original?.tirFrequency ?? null,
    tirSemiAnnualReviewPeriodStart: original?.tirSemiAnnualReviewPeriodStart ?? null,
    tirSemiAnnualReviewPeriodEnd: original?.tirSemiAnnualReviewPeriodEnd ?? null,
    tirSemiAnnualSubmission: original?.tirSemiAnnualSubmission ?? null,
    tirSemiAnnualReview: original?.tirSemiAnnualReview ?? null,
    lastAuditFiscalYear: original?.lastAuditFiscalYear ?? null,
    auditCompletionYear: original?.auditCompletionYear ?? null,
    auditCompletionStatus: original?.auditCompletionStatus ?? null,
    lastMonthlyReportReceived: original?.lastMonthlyReportReceived ?? null,
    leaseExpiration: original?.leaseExpiration ?? null,
    idExpiration: original?.idExpiration ?? null,
    lastCompensationStudy: original?.lastCompensationStudy ?? null,
    bondIssuedDate: original?.bondIssuedDate ?? null,
    bondRenewalDate: original?.bondRenewalDate ?? null,
    budgetCompletionYear: original?.budgetCompletionYear ?? null,
    budgetCompletionStatus: original?.budgetCompletionStatus ?? null,
    annualReportCompletionYear: original?.annualReportCompletionYear ?? null,
    annualReportCompletionStatus: original?.annualReportCompletionStatus ?? null,
  };

  if (section === 'audit') {
    const bothCompletion = !!(auditForm.auditCompletionYear && auditForm.auditCompletionStatus);
    return {
      ...base,
      upcomingExamOrAuditYear: auditForm.upcomingExamOrAuditYear || null,
      upcomingExamOrAuditType: auditForm.upcomingExamOrAuditType || null,
      pastAudit: auditForm.pastAudit || null,
      lastAuditFiscalYear: auditForm.lastAuditFiscalYear || null,
      pastFieldExam: auditForm.pastFieldExam || null,
      auditCompletionYear: bothCompletion ? (auditForm.auditCompletionYear as number) : null,
      auditCompletionStatus: bothCompletion ? (auditForm.auditCompletionStatus as CompletionStatus) : null,
    };
  }

  if (section === 'tpr') {
    const bothCompletion = !!(tprForm.tprCompletionYear && tprForm.tprCompletionStatus);
    return {
      ...base,
      tprReviewPeriodStart: tprForm.tprReviewPeriodStart || null,
      tprReviewPeriodEnd: tprForm.tprReviewPeriodEnd || null,
      tprFrequency: tprForm.tprFrequency || null,
      tprDue: tprForm.tprDue || null,
      tprDueYearType: tprForm.tprDueYearType || null,
      lastTprSubmitted: tprForm.lastTprSubmitted || null,
      tprCompletionYear: bothCompletion ? (tprForm.tprCompletionYear as number) : null,
      tprCompletionStatus: bothCompletion ? (tprForm.tprCompletionStatus as CompletionStatus) : null,
    };
  }

  if (section === 'tir') {
    const option = [...ANNUAL_PERIOD_OPTIONS, ...SEMI_ANNUAL_PERIOD_OPTIONS].find(
      (o) => o.value === tirForm.tirPeriodKey,
    );
    const tirStart = option?.start ?? null;
    const tirEnd = option?.end ?? null;
    const semiStart = option?.semiStart ?? null;
    const semiEnd = option?.semiEnd ?? null;
    const tirSubmission = tirEnd ? calculateTirSubmission(tirEnd) : null;
    const tirReview = tirSubmission ? calculateTirReview(tirSubmission) : null;
    const semiSubmission = semiEnd ? calculateTirSubmission(semiEnd) : null;
    const semiReview = semiSubmission ? calculateTirReview(semiSubmission) : null;
    const bothCompletion = !!(tirForm.tirCompletionYear && tirForm.tirCompletionStatus);
    return {
      ...base,
      tirFrequency: tirForm.tirFrequency || null,
      tirReviewPeriodStart: tirStart,
      tirReviewPeriodEnd: tirEnd,
      tirSubmission,
      tirReview,
      tirSemiAnnualReviewPeriodStart: semiStart,
      tirSemiAnnualReviewPeriodEnd: semiEnd,
      tirSemiAnnualSubmission: semiSubmission,
      tirSemiAnnualReview: semiReview,
      pastTprSubmission: tirForm.pastTprSubmission || null,
      tirCompletionYear: bothCompletion ? (tirForm.tirCompletionYear as number) : null,
      tirCompletionStatus: bothCompletion ? (tirForm.tirCompletionStatus as CompletionStatus) : null,
    };
  }


  if (section === 'annual-report') {
    const bothCompletion = !!(annualReportForm.annualReportCompletionYear && annualReportForm.annualReportCompletionStatus);
    return {
      ...base,
      annualReportCompletionYear: bothCompletion ? (annualReportForm.annualReportCompletionYear as number) : null,
      annualReportCompletionStatus: bothCompletion ? (annualReportForm.annualReportCompletionStatus as CompletionStatus) : null,
    };
  }

  // other
  return {
    ...base,
    pastBackgroundQuestion: otherForm.pastBackgroundQuestion || null,
    leaseExpiration: otherForm.leaseExpiration || null,
    idExpiration: otherForm.idExpiration || null,
    lastMonthlyReportReceived: otherForm.lastMonthlyReportReceived || null,
    lastCompensationStudy: otherForm.lastCompensationStudy || null,
  };
}

// ── Main component ──────────────────────────────────────────────────────────

export default function EditKeyDatesV2Form() {
  const { trusteeId, appointmentId, section } = useParams<{
    trusteeId: string;
    appointmentId: string;
    section: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const globalAlert = useGlobalAlert();
  const canManage = !!LocalStorage.getSession()?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  const locationState = location.state as {
    keyDatesData?: TrusteeUpcomingKeyDates;
    chapter?: string;
    appointmentType?: string;
  } | null;

  const { chapter, appointmentType } = locationState ?? {};
  const isChapter12 = (chapter === '12' || chapter === '13') && appointmentType === 'standing';
  const isChapter13Standing = chapter === '13' && appointmentType === 'standing';
  const isSubVPool = chapter === '11-subchapter-v' && appointmentType === 'pool';

  const [isLoading, setIsLoading] = useState(!locationState?.keyDatesData);
  const [isSaving, setIsSaving] = useState(false);
  const [original, setOriginal] = useState<TrusteeUpcomingKeyDates | null>(
    locationState?.keyDatesData ?? null,
  );

  const [auditForm, setAuditForm] = useState<AuditForm>(() =>
    initAudit(locationState?.keyDatesData ?? null),
  );
  const [tprForm, setTprForm] = useState<TprForm>(() =>
    initTpr(locationState?.keyDatesData ?? null),
  );
  const [tirForm, setTirForm] = useState<TirForm>(() =>
    initTir(locationState?.keyDatesData ?? null),
  );
  const [budgetForm, setBudgetForm] = useState<BudgetForm>(() =>
    initBudget(locationState?.keyDatesData ?? null),
  );
  const [otherForm, setOtherForm] = useState<OtherForm>(() =>
    initOther(locationState?.keyDatesData ?? null),
  );
  const [annualReportForm, setAnnualReportForm] = useState<AnnualReportForm>(() =>
    initAnnualReport(locationState?.keyDatesData ?? null),
  );

  useEffect(() => {
    if (locationState?.keyDatesData) return;
    Api2.getUpcomingKeyDates(trusteeId!, appointmentId!)
      .then((res) => {
        const data = res.data;
        setOriginal(data);
        setAuditForm(initAudit(data));
        setTprForm(initTpr(data));
        setTirForm(initTir(data));
        setBudgetForm(initBudget(data));
        setOtherForm(initOther(data));
        setAnnualReportForm(initAnnualReport(data));
      })
      .catch(() => globalAlert?.error('Failed to load key dates.'))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleSave() {
    setIsSaving(true);
    const sectionKey = section as SectionKey;
    const input = buildInput(
      trusteeId!,
      appointmentId!,
      original,
      sectionKey,
      auditForm,
      tprForm,
      tirForm,
      budgetForm,
      otherForm,
      annualReportForm,
    );
    try {
      await Api2.putUpcomingKeyDates(trusteeId!, appointmentId!, input);
      navigate(`/trustees/${trusteeId}/appointments`);
    } catch (err) {
      const msg = `Failed to save key dates: ${(err as Error).message}`;
      console.error(msg, err);
      globalAlert?.error(msg);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    navigate(`/trustees/${trusteeId}/appointments`);
  }

  if (!canManage) {
    return (
      <Stop
        id="forbidden-alert"
        title="Forbidden"
        message="You do not have permission to manage Trustee Key Dates"
        asError
      />
    );
  }

  if (isLoading) {
    return <LoadingSpinner id="edit-key-dates-v2-loading" />;
  }

  const sectionKey = section as SectionKey;

  return (
    <div className="edit-upcoming-key-dates" data-testid="edit-key-dates-v2">
      {sectionKey === 'audit' && (
        <AuditSection form={auditForm} setForm={setAuditForm} isChapter12={isChapter12} isChapter13Standing={isChapter13Standing} />
      )}
      {sectionKey === 'tpr' && (
        <TprSection form={tprForm} setForm={setTprForm} />
      )}
      {sectionKey === 'tir' && (
        <TirSection form={tirForm} setForm={setTirForm} />
      )}

      {sectionKey === 'annual-report' && (
        <AnnualReportSection form={annualReportForm} setForm={setAnnualReportForm} />
      )}
      {sectionKey === 'other' && (
        <OtherSection form={otherForm} setForm={setOtherForm} isChapter12={isChapter12} isChapter13Standing={isChapter13Standing} isSubVPool={isSubVPool} />
      )}

      <div className="usa-button-group">
        <Button id="save-key-dates-v2" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id="cancel-key-dates-v2"
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
