import './EditUpcomingKeyDates.scss';
import { useEffect, useState, type FocusEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
  validateTrusteeUpcomingKeyDates,
  validateTprDuePair,
  calculateTirSubmission,
  calculateTirReview,
  isoToSentinel,
} from '@common/cams/trustee-upcoming-key-dates';
import {
  TrusteeAppointment,
  isChapter12Or13CaseByCase,
  isChapter12Standing,
  isChapter13Standing,
} from '@common/cams/trustee-appointments';
import { AppointmentChapterType, AppointmentType } from '@common/cams/trustees';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import MonthDaySelector from '@/lib/components/uswds/MonthDaySelector';
import MonthDayRangeSelector from '@/lib/components/uswds/MonthDayRangeSelector';
import DatePicker from '@/lib/components/uswds/DatePicker';
import Select from '@/lib/components/uswds/Select';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import useDateFieldErrors from '@/lib/hooks/UseDateFieldErrors';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { Stop } from '@/lib/components/Stop';
import {
  UPCOMING_KEY_DATES_FIELD_CONFIG,
  UpcomingKeyDatesVariant,
} from '@/trustees/panels/upcomingKeyDatesFieldConfig';
import {
  getUpcomingKeyDatesFormConfig,
  DatePickerFieldDescriptor,
  UpcomingFormFieldDescriptor,
} from './upcomingKeyDatesFormFieldConfig';
import {
  TirFrequency,
  ANNUAL_OPTIONS,
  SEMI_ANNUAL_OPTIONS,
  findPeriodKey,
} from './tirPeriodOptions';

type FormState = {
  pastBackgroundQuestion: string;
  pastFieldExam: string;
  pastAudit: string;
  pastTprSubmission: string;
  lastTprSubmitted: string;
  tprReviewPeriodStart: string;
  tprReviewPeriodEnd: string;
  tprDue: string;
  tprDueYearType: string;
  tprFrequency: 'BIANNUAL' | 'ANNUAL' | 'SEMI_ANNUAL' | '';
  upcomingExamOrAuditYear: number | '';
  upcomingExamOrAuditType: 'Field Exam' | 'Audit' | '';
  tirFrequency: TirFrequency;
  tirPeriodKey: string;
  tirReviewPeriodStart: string;
  tirReviewPeriodEnd: string;
  tirSemiAnnualReviewPeriodStart: string;
  tirSemiAnnualReviewPeriodEnd: string;
  lastAuditFiscalYear: number | null;
  auditCompletionYear: number | null;
  auditCompletionStatus: 'CLOSED' | 'NOT_CLOSED' | null;
  tprCompletionYear: number | null;
  tprCompletionStatus: 'COMPLETE' | 'INCOMPLETE' | null;
  tirCompletionYear: number | null;
  tirCompletionStatus: 'COMPLETE' | 'INCOMPLETE' | null;
  annualReportCompletionYear: number | null;
  annualReportCompletionStatus: 'COMPLETE' | 'INCOMPLETE' | null;
  lastMonthlyReportReceived: string;
  leaseExpiration: string;
  idExpiration: string;
  lastCompensationStudy: string;
  bondIssuedDate: string;
  bondRenewalDate: string;
  ch13AuditCompletionYear: number | null;
  ch13AuditCompletionStatus: 'Complete' | 'Incomplete' | '';
  ch13TprCompletionYear: number | null;
  ch13TprCompletionStatus: 'Complete' | 'Incomplete' | '';
};

const EMPTY_FORM: FormState = {
  pastBackgroundQuestion: '',
  pastFieldExam: '',
  pastAudit: '',
  pastTprSubmission: '',
  lastTprSubmitted: '',
  tprReviewPeriodStart: '',
  tprReviewPeriodEnd: '',
  tprDue: '',
  tprDueYearType: '',
  tprFrequency: '',
  upcomingExamOrAuditYear: '',
  upcomingExamOrAuditType: '',
  tirFrequency: '',
  tirPeriodKey: '',
  tirReviewPeriodStart: '',
  tirReviewPeriodEnd: '',
  tirSemiAnnualReviewPeriodStart: '',
  tirSemiAnnualReviewPeriodEnd: '',
  lastAuditFiscalYear: null,
  auditCompletionYear: null,
  auditCompletionStatus: null,
  tprCompletionYear: null,
  tprCompletionStatus: null,
  tirCompletionYear: null,
  tirCompletionStatus: null,
  annualReportCompletionYear: null,
  annualReportCompletionStatus: null,
  lastMonthlyReportReceived: '',
  leaseExpiration: '',
  idExpiration: '',
  lastCompensationStudy: '',
  bondIssuedDate: '',
  bondRenewalDate: '',
  ch13AuditCompletionYear: null,
  ch13AuditCompletionStatus: '',
  ch13TprCompletionYear: null,
  ch13TprCompletionStatus: '',
};

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => currentYear + i);

function deriveVariant(
  chapter: AppointmentChapterType,
  appointmentType: AppointmentType,
): UpcomingKeyDatesVariant {
  if (isChapter12Standing(chapter, appointmentType)) {
    return 'chapter12-standing';
  }
  if (isChapter13Standing(chapter, appointmentType)) {
    return 'chapter13-standing';
  }
  return 'chapter7-panel';
}

function buildFormStateFromData(data: TrusteeUpcomingKeyDates): FormState {
  const tirFrequency: TirFrequency = data.tirFrequency ?? '';
  return {
    pastBackgroundQuestion: data.pastBackgroundQuestion ?? '',
    pastFieldExam: data.pastFieldExam ?? '',
    pastAudit: data.pastAudit ?? '',
    pastTprSubmission: data.pastTprSubmission ?? '',
    lastTprSubmitted: data.lastTprSubmitted ?? '',
    tprReviewPeriodStart: data.tprReviewPeriodStart ?? '',
    tprReviewPeriodEnd: data.tprReviewPeriodEnd ?? '',
    tprDue: data.tprDue ?? '',
    tprDueYearType: data.tprDueYearType ?? '',
    tprFrequency: data.tprFrequency ?? '',
    upcomingExamOrAuditYear: data.upcomingExamOrAuditYear ?? '',
    upcomingExamOrAuditType: data.upcomingExamOrAuditType ?? '',
    tirFrequency,
    tirPeriodKey: findPeriodKey(data.tirReviewPeriodStart, data.tirReviewPeriodEnd, tirFrequency),
    tirReviewPeriodStart: data.tirReviewPeriodStart ?? '',
    tirReviewPeriodEnd: data.tirReviewPeriodEnd ?? '',
    tirSemiAnnualReviewPeriodStart: data.tirSemiAnnualReviewPeriodStart ?? '',
    tirSemiAnnualReviewPeriodEnd: data.tirSemiAnnualReviewPeriodEnd ?? '',
    lastAuditFiscalYear: data.lastAuditFiscalYear ?? null,
    auditCompletionYear: data.auditCompletionYear ?? null,
    auditCompletionStatus: data.auditCompletionStatus ?? null,
    tprCompletionYear: data.tprCompletionYear ?? null,
    tprCompletionStatus: data.tprCompletionStatus ?? null,
    tirCompletionYear: data.tirCompletionYear ?? null,
    tirCompletionStatus: data.tirCompletionStatus ?? null,
    annualReportCompletionYear: data.annualReportCompletionYear ?? null,
    annualReportCompletionStatus: data.annualReportCompletionStatus ?? null,
    lastMonthlyReportReceived: data.lastMonthlyReportReceived ?? '',
    leaseExpiration: data.leaseExpiration ?? '',
    idExpiration: data.idExpiration ?? '',
    lastCompensationStudy: data.lastCompensationStudy ?? '',
    bondIssuedDate: data.bondIssuedDate ?? '',
    bondRenewalDate: data.bondRenewalDate ?? '',
    ch13AuditCompletionYear: data.ch13AuditCompletionYear ?? null,
    ch13AuditCompletionStatus: data.ch13AuditCompletionStatus ?? '',
    ch13TprCompletionYear: data.ch13TprCompletionYear ?? null,
    ch13TprCompletionStatus: data.ch13TprCompletionStatus ?? '',
  };
}

type FormLoadResult = {
  variant: UpcomingKeyDatesVariant;
  loadError: boolean;
  variantAlert: string | null;
  formState: FormState | null;
  keyDatesAlert: string | null;
  /**
   * Chapter 12/13 Case by Case appointments have their own dedicated edit pages
   * (CAMS-913). This generic form can still be reached for them by a stale or
   * typed URL, where it would offer a second, narrower editor writing the same
   * fields, so the form sends the user to the appointments list instead.
   */
  movedToDedicatedForm: boolean;
};

function resolveFormLoadResult(
  variantFromState: UpcomingKeyDatesVariant | undefined,
  appointmentId: string,
  appointmentsResult: PromiseSettledResult<{ data: TrusteeAppointment[] } | null>,
  keyDatesResult: PromiseSettledResult<{ data: TrusteeUpcomingKeyDates | null }>,
): FormLoadResult {
  let variant: UpcomingKeyDatesVariant = variantFromState ?? 'chapter7-panel';
  let loadError = false;
  let variantAlert: string | null = null;
  let movedToDedicatedForm = false;

  if (!variantFromState) {
    if (appointmentsResult.status === 'fulfilled') {
      const appointment = (appointmentsResult.value?.data ?? []).find(
        (a) => a.id === appointmentId,
      );
      if (
        appointment &&
        isChapter12Or13CaseByCase(appointment.chapter, appointment.appointmentType)
      ) {
        movedToDedicatedForm = true;
      } else if (appointment) {
        variant = deriveVariant(appointment.chapter, appointment.appointmentType);
      } else {
        variantAlert = 'Could not determine appointment type; showing default fields.';
      }
    } else {
      loadError = true;
    }
  }

  let formState: FormState | null = null;
  let keyDatesAlert: string | null = null;
  if (keyDatesResult.status === 'fulfilled') {
    const data = keyDatesResult.value.data;
    if (data) {
      formState = buildFormStateFromData(data);
    }
  } else {
    keyDatesAlert = `Failed to load upcoming key dates: ${(keyDatesResult.reason as Error).message}`;
  }

  return { variant, loadError, variantAlert, formState, keyDatesAlert, movedToDedicatedForm };
}

export default function UpcomingKeyDatesForm({
  tprDisplayUpdates = true,
}: {
  tprDisplayUpdates?: boolean;
} = {}) {
  const { trusteeId, appointmentId } = useParams<{
    trusteeId: string;
    appointmentId: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const globalAlert = useGlobalAlert();
  const canManage = useCanManageTrustees();

  // Router state survives a reload and outlives a deploy, so it can still name
  // a variant this form no longer serves -- a Chapter 12/13 Case by Case entry
  // created before those moved to their own pages, for instance. An unknown
  // name is treated as absent so the appointment is fetched and resolved
  // normally, which is also what triggers the redirect for the moved variant.
  const rawVariantFromState = (location.state as { variant?: string } | null)?.variant;
  const variantFromState =
    rawVariantFromState && rawVariantFromState in UPCOMING_KEY_DATES_FIELD_CONFIG
      ? (rawVariantFromState as UpcomingKeyDatesVariant)
      : undefined;

  const [variant, setVariant] = useState<UpcomingKeyDatesVariant | undefined>(variantFromState);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState({
    tprReviewPeriodStart: '',
    tprReviewPeriodEnd: '',
    tprDue: '',
    tprDueYearType: '',
  });
  const { registerFieldError, hasErrorAmong } = useDateFieldErrors();
  const [tprDueRowFocused, setTprDueRowFocused] = useState(false);
  const [tprDueRowHasInteracted, setTprDueRowHasInteracted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [validationState, setValidationState] = useState({ tprReviewPeriod: true });
  const [tprReviewPeriodFocused, setTprReviewPeriodFocused] = useState(false);

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
    const appointmentsPromise = variantFromState
      ? Promise.resolve(null)
      : Api2.getTrusteeAppointments(trusteeId!);

    Promise.allSettled([
      appointmentsPromise,
      Api2.getUpcomingKeyDates(trusteeId!, appointmentId!),
    ]).then(([appointmentsResult, keyDatesResult]) => {
      const result = resolveFormLoadResult(
        variantFromState,
        appointmentId!,
        appointmentsResult,
        keyDatesResult,
      );

      if (result.movedToDedicatedForm) {
        navigate(`/trustees/${trusteeId}/appointments`, { replace: true });
        return;
      }
      if (!variantFromState) {
        setVariant(result.variant);
      }
      if (result.loadError) {
        setLoadError(true);
      }
      if (result.variantAlert) {
        globalAlert?.error(result.variantAlert);
      }
      if (result.formState) {
        setForm(result.formState);
      }
      if (result.keyDatesAlert) {
        globalAlert?.error(result.keyDatesAlert);
      }

      setIsLoading(false);
    });
  }, [trusteeId, appointmentId, variantFromState, globalAlert]);

  function handleTprDueChange(value: string) {
    setForm((prev) => ({ ...prev, tprDue: value }));
    setErrors((prev) => ({ ...prev, tprDue: '', tprDueYearType: '' }));
  }

  function handleYearTypeChange(ev: React.ChangeEvent<HTMLSelectElement>) {
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
    const option = allOptions.find((o) => o.key === key);
    if (option) {
      setForm((prev) => ({
        ...prev,
        tirPeriodKey: key,
        tirReviewPeriodStart: option.start,
        tirReviewPeriodEnd: option.end,
        tirSemiAnnualReviewPeriodStart: option.start2 ?? '',
        tirSemiAnnualReviewPeriodEnd: option.end2 ?? '',
      }));
    }
  }

  async function handleSave() {
    let tirSubmission: string | null = null;
    let tirReview: string | null = null;
    let tirSemiAnnualSubmission: string | null = null;
    let tirSemiAnnualReview: string | null = null;

    if (form.tirReviewPeriodEnd) {
      const sub = calculateTirSubmission(form.tirReviewPeriodEnd);
      tirSubmission = sub;
      tirReview = calculateTirReview(sub);
    }

    if (form.tirFrequency === 'SEMI_ANNUAL' && form.tirSemiAnnualReviewPeriodEnd) {
      const sub2 = calculateTirSubmission(form.tirSemiAnnualReviewPeriodEnd);
      tirSemiAnnualSubmission = sub2;
      tirSemiAnnualReview = calculateTirReview(sub2);
    }

    const isoInput: TrusteeUpcomingKeyDatesInput = {
      trusteeId: trusteeId!,
      appointmentId: appointmentId!,
      pastBackgroundQuestion: form.pastBackgroundQuestion || null,
      pastFieldExam: form.pastFieldExam || null,
      pastAudit: form.pastAudit || null,
      pastTprSubmission: form.pastTprSubmission || null,
      lastTprSubmitted: form.lastTprSubmitted || null,
      tprReviewPeriodStart: tprDisplayUpdates
        ? form.tprReviewPeriodStart || null
        : form.tprReviewPeriodStart
          ? isoToSentinel(form.tprReviewPeriodStart)
          : null,
      tprReviewPeriodEnd: tprDisplayUpdates
        ? form.tprReviewPeriodEnd || null
        : form.tprReviewPeriodEnd
          ? isoToSentinel(form.tprReviewPeriodEnd)
          : null,
      tprDue: form.tprDue ? isoToSentinel(form.tprDue) : null,
      tprDueYearType: form.tprDueYearType || null,
      tprFrequency: (form.tprFrequency as 'BIANNUAL' | 'ANNUAL' | 'SEMI_ANNUAL') || null,
      upcomingExamOrAuditYear:
        form.upcomingExamOrAuditYear !== '' ? form.upcomingExamOrAuditYear : null,
      upcomingExamOrAuditType: form.upcomingExamOrAuditType || null,
      tirFrequency: form.tirFrequency || null,
      tirReviewPeriodStart: form.tirReviewPeriodStart || null,
      tirReviewPeriodEnd: form.tirReviewPeriodEnd || null,
      tirSubmission,
      tirReview,
      tirSemiAnnualReviewPeriodStart:
        form.tirFrequency === 'SEMI_ANNUAL' ? form.tirSemiAnnualReviewPeriodStart || null : null,
      tirSemiAnnualReviewPeriodEnd:
        form.tirFrequency === 'SEMI_ANNUAL' ? form.tirSemiAnnualReviewPeriodEnd || null : null,
      tirSemiAnnualSubmission,
      tirSemiAnnualReview,
      lastAuditFiscalYear: form.lastAuditFiscalYear,
      auditCompletionYear: form.auditCompletionYear,
      auditCompletionStatus: form.auditCompletionStatus,
      tprCompletionYear: form.tprCompletionYear,
      tprCompletionStatus: form.tprCompletionStatus,
      tirCompletionYear: form.tirCompletionYear,
      tirCompletionStatus: form.tirCompletionStatus,
      annualReportCompletionYear: form.annualReportCompletionYear,
      annualReportCompletionStatus: form.annualReportCompletionStatus,
      lastMonthlyReportReceived: form.lastMonthlyReportReceived || null,
      leaseExpiration: form.leaseExpiration || null,
      idExpiration: form.idExpiration || null,
      lastCompensationStudy: form.lastCompensationStudy || null,
      bondIssuedDate: form.bondIssuedDate || null,
      bondRenewalDate: form.bondRenewalDate || null,
      ch13AuditCompletionYear: form.ch13AuditCompletionYear,
      ch13AuditCompletionStatus: form.ch13AuditCompletionStatus || null,
      ch13TprCompletionYear: form.ch13TprCompletionYear,
      ch13TprCompletionStatus: form.ch13TprCompletionStatus || null,
    };

    if (!tprDisplayUpdates) {
      setSubmitted(true);
    }
    const result = validateTrusteeUpcomingKeyDates(isoInput);
    setErrors({
      tprReviewPeriodStart: result.reasonMap?.tprReviewPeriodStart?.reasons?.[0] ?? '',
      tprReviewPeriodEnd: result.reasonMap?.tprReviewPeriodEnd?.reasons?.[0] ?? '',
      tprDue: result.reasonMap?.tprDue?.reasons?.[0] ?? '',
      tprDueYearType: result.reasonMap?.tprDueYearType?.reasons?.[0] ?? '',
    });

    if ((!tprDisplayUpdates && !validationState.tprReviewPeriod) || !result.valid) {
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

  if (isLoading || !variant) {
    return <LoadingSpinner id="edit-upcoming-key-dates-loading" />;
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

  if (loadError) {
    return (
      <Alert
        id="upcoming-key-dates-load-error"
        type={UswdsAlertStyle.Error}
        title="Something went wrong"
        show
        inline
      >
        Please refresh and try again.
      </Alert>
    );
  }

  const config = getUpcomingKeyDatesFormConfig(variant, tprDisplayUpdates);
  const datePickerIds = config
    .filter((d): d is DatePickerFieldDescriptor => typeof d !== 'string')
    .map((d) => d.id);

  const hasTprReviewPeriod = (config as UpcomingFormFieldDescriptor[]).includes(
    'tpr-review-period',
  );
  const tprReviewPeriodDatePickerIds =
    hasTprReviewPeriod && tprDisplayUpdates
      ? ['tpr-review-period-start', 'tpr-review-period-end']
      : [];
  const allDatePickerIds = [...datePickerIds, ...tprReviewPeriodDatePickerIds];

  const isSaveDisabled =
    isSaving ||
    !!errors.tprDue ||
    !!errors.tprDueYearType ||
    !!tprDueBlurError ||
    (!tprDisplayUpdates && !validationState.tprReviewPeriod && !tprReviewPeriodFocused) ||
    (allDatePickerIds.length > 0 && hasErrorAmong(allDatePickerIds));

  function renderField(descriptor: UpcomingFormFieldDescriptor) {
    const kind = typeof descriptor === 'string' ? descriptor : descriptor.kind;
    switch (kind) {
      case 'exam-audit-group':
        return (
          <div key="exam-audit-group" className="exam-audit-group">
            <p className="usa-label">Field Exam or Audit</p>
            <div className="exam-audit-group__row">
              <Select
                id="upcoming-exam-audit-year"
                label="Year"
                compactLabel
                placeholder="- Select -"
                options={YEAR_OPTIONS.map((y) => ({ value: String(y), label: String(y) }))}
                value={
                  form.upcomingExamOrAuditYear === '' ? '' : String(form.upcomingExamOrAuditYear)
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    upcomingExamOrAuditYear: val ? Number(val) : '',
                  }));
                }}
              />
              <Select
                id="upcoming-exam-audit-type"
                label="Type"
                compactLabel
                placeholder="- Select -"
                options={[
                  { value: 'Field Exam', label: 'Field Exam' },
                  { value: 'Audit', label: 'Audit' },
                ]}
                value={form.upcomingExamOrAuditType}
                onChange={(e) => {
                  setForm((prev) => ({
                    ...prev,
                    upcomingExamOrAuditType: e.target.value as 'Field Exam' | 'Audit' | '',
                  }));
                }}
              />
            </div>
          </div>
        );

      case 'tpr-review-period':
        if (tprDisplayUpdates) {
          return (
            <div
              key="tpr-review-period"
              onFocus={(e) => {
                const id = (e.target as HTMLElement).id;
                if (id === 'tpr-review-period-start') {
                  setErrors((prev) => ({ ...prev, tprReviewPeriodStart: '' }));
                } else if (id === 'tpr-review-period-end') {
                  setErrors((prev) => ({ ...prev, tprReviewPeriodEnd: '' }));
                }
              }}
              onBlur={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;

                const { tprReviewPeriodStart: start, tprReviewPeriodEnd: end } = form;
                if (!start || !end || start <= end) return;

                setErrors((prev) => ({
                  ...prev,
                  tprReviewPeriodStart:
                    'TPR Review Period Start must be before TPR Review Period End.',
                  tprReviewPeriodEnd:
                    'TPR Review Period End must be after TPR Review Period Start.',
                }));
              }}
            >
              <DatePicker
                id="tpr-review-period-start"
                label="Trustee Performance Review Period Start"
                value={form.tprReviewPeriodStart}
                disableMax
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, tprReviewPeriodStart: e.target.value }));
                  setErrors((prev) => ({
                    ...prev,
                    tprReviewPeriodStart: '',
                    tprReviewPeriodEnd: '',
                  }));
                }}
                onValidationChange={(hasError) =>
                  registerFieldError('tpr-review-period-start', hasError)
                }
                customErrorMessage={errors.tprReviewPeriodStart}
              />
              <DatePicker
                id="tpr-review-period-end"
                label="Trustee Performance Review Period End"
                value={form.tprReviewPeriodEnd}
                disableMax
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, tprReviewPeriodEnd: e.target.value }));
                  setErrors((prev) => ({
                    ...prev,
                    tprReviewPeriodStart: '',
                    tprReviewPeriodEnd: '',
                  }));
                }}
                onValidationChange={(hasError) =>
                  registerFieldError('tpr-review-period-end', hasError)
                }
                customErrorMessage={errors.tprReviewPeriodEnd}
              />
            </div>
          );
        }
        return (
          <div
            key="tpr-review-period"
            onFocus={() => setTprReviewPeriodFocused(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setTprReviewPeriodFocused(false);
              }
            }}
          >
            <MonthDayRangeSelector
              id="tpr-review-period"
              label="Trustee Performance Review (TPR) Period"
              startValue={form.tprReviewPeriodStart}
              endValue={form.tprReviewPeriodEnd}
              onStartChange={(value) => {
                setForm((prev) => ({ ...prev, tprReviewPeriodStart: value }));
                setErrors((prev) => ({ ...prev, tprReviewPeriodStart: '' }));
              }}
              onEndChange={(value) => {
                setForm((prev) => ({ ...prev, tprReviewPeriodEnd: value }));
                setErrors((prev) => ({ ...prev, tprReviewPeriodEnd: '' }));
              }}
              onValidationChange={(isValid) =>
                setValidationState((prev) => ({ ...prev, tprReviewPeriod: isValid }))
              }
              externalError={errors.tprReviewPeriodStart || errors.tprReviewPeriodEnd}
              submitted={submitted}
            />
          </div>
        );

      case 'tpr-frequency':
        return (
          <Select
            key="tpr-frequency"
            id="tpr-frequency"
            label="Trustee Performance Review Period Frequency"
            placeholder="- Select -"
            options={[
              { value: 'BIANNUAL', label: 'Two years' },
              { value: 'ANNUAL', label: 'One year' },
              { value: 'SEMI_ANNUAL', label: '6 months' },
            ]}
            value={form.tprFrequency}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                tprFrequency: e.target.value as 'BIANNUAL' | 'ANNUAL' | 'SEMI_ANNUAL' | '',
              }))
            }
          />
        );

      case 'tpr-due':
        return (
          <div key="tpr-due" className="tpr-due-group">
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
                onChange={handleTprDueChange}
                hasError={!!errors.tprDue || (!tprDueDateComplete && !!tprDueBlurError)}
              />
              <Select
                id="tpr-due-year-type"
                label="Year Type"
                compactLabel
                hasError={!!errors.tprDueYearType || !!tprDueYearTypeBlurError}
                placeholder="- Select -"
                options={[
                  { value: 'EVEN', label: 'EVEN' },
                  { value: 'ODD', label: 'ODD' },
                ]}
                value={form.tprDueYearType}
                onChange={handleYearTypeChange}
                className="year-type-selector"
              />
            </div>
            {(tprDueBlurError || errors.tprDue || errors.tprDueYearType) && (
              <span className="cams-field-error-message" data-testid="tpr-due-error">
                {tprDueBlurError || errors.tprDue || errors.tprDueYearType}
              </span>
            )}
          </div>
        );

      case 'tir-period':
        return (
          <div key="tir-period" className="tir-period-group">
            <p className="usa-label">Trustee Interim Report (TIR) Period</p>
            <div className="tir-period-group__row">
              <Select
                id="tir-frequency"
                label="Frequency"
                compactLabel
                placeholder="- Select -"
                options={[
                  { value: 'ANNUAL', label: 'Annual' },
                  { value: 'SEMI_ANNUAL', label: 'Semi-Annual' },
                ]}
                value={form.tirFrequency}
                onChange={handleFrequencyChange}
              />
              <Select
                id="tir-period"
                label="Period"
                compactLabel
                placeholder="- Select -"
                options={periodOptions.map((o) => ({ value: o.key, label: o.label }))}
                value={form.tirPeriodKey}
                onChange={handlePeriodChange}
                disabled={!form.tirFrequency}
              />
            </div>
          </div>
        );

      case 'date-picker': {
        const f = descriptor as DatePickerFieldDescriptor;
        return (
          <DatePicker
            key={f.id}
            id={f.id}
            label={f.label}
            value={form[f.formKey]}
            disableMax
            onChange={(e) =>
              setForm((prev) => ({ ...prev, [f.formKey]: e.target.value }) as FormState)
            }
            onValidationChange={(hasError) => registerFieldError(f.id, hasError)}
          />
        );
      }

      default:
        return null;
    }
  }

  return (
    <div className="edit-upcoming-key-dates" data-testid="edit-upcoming-key-dates">
      <h3>Edit Upcoming Key Dates</h3>
      {config.map(renderField)}
      <div className="usa-button-group">
        <Button id="save-upcoming-key-dates" onClick={handleSave} disabled={isSaveDisabled}>
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
