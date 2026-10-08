import './EditUpcomingKeyDates.scss';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
  isoToSentinel,
} from '@common/cams/trustee-upcoming-key-dates';
import {
  PAST_KEY_DATES_FIELD_CONFIG,
  PAST_KEY_DATES_VARIANT_LABELS,
  PastDateFieldKey,
  PastKeyDatesVariant,
} from '@/trustees/panels/pastKeyDatesFieldConfig';
import Api2 from '@/lib/models/api2';
import { isChapter11SubchapterV, isChapter13Standing } from '@common/cams/trustee-appointments';
import { AppointmentChapterType, AppointmentType } from '@common/cams/trustees';
import { buildYearOptions, mergeKeyDatesInput } from './keyDatesInput';
import DatePicker from '@/lib/components/uswds/DatePicker';
import MonthYearSelector from '@/lib/components/uswds/MonthYearSelector';
import Select from '@/lib/components/uswds/Select';
import { useKeyDatesFormShell } from './useKeyDatesFormShell';
import { KeyDatesFormShell } from './KeyDatesFormShell';

type PastKeyDatesFormState = Record<PastDateFieldKey, string> & {
  lastAuditFiscalYear: number | '';
};

const EMPTY_FORM: PastKeyDatesFormState = {
  pastBackgroundQuestion: '',
  pastFieldExam: '',
  pastAudit: '',
  pastTprSubmission: '',
  lastMonthlyReportReceived: '',
  lastCompensationStudy: '',
  bondIssuedDate: '',
  lastAuditFiscalYear: '',
};

function buildUpcomingKeyDatesInput(
  ids: { trusteeId: string; appointmentId: string },
  original: TrusteeUpcomingKeyDates | null,
  form: PastKeyDatesFormState,
  opts: { activeDateKeys: Set<PastDateFieldKey>; hasYearField: boolean },
): TrusteeUpcomingKeyDatesInput {
  const { activeDateKeys, hasYearField } = opts;

  function dateValue(key: PastDateFieldKey): string | null {
    return activeDateKeys.has(key) ? form[key] || null : (original?.[key] ?? null);
  }

  // These fields aren't edited by this form, but unlike mergeKeyDatesInput's
  // plain original?.field ?? null default, they still need ISO-to-sentinel
  // normalization applied on every carry-forward save.
  function sentinel(value: string | undefined): string | null {
    return value ? isoToSentinel(value) : null;
  }

  return mergeKeyDatesInput(ids, original, {
    pastBackgroundQuestion: dateValue('pastBackgroundQuestion'),
    pastFieldExam: dateValue('pastFieldExam'),
    pastAudit: dateValue('pastAudit'),
    pastTprSubmission: dateValue('pastTprSubmission'),
    lastMonthlyReportReceived: dateValue('lastMonthlyReportReceived'),
    tprDue: sentinel(original?.tprDue),
    tirReviewPeriodStart: sentinel(original?.tirReviewPeriodStart),
    tirReviewPeriodEnd: sentinel(original?.tirReviewPeriodEnd),
    tirSubmission: sentinel(original?.tirSubmission),
    tirReview: sentinel(original?.tirReview),
    tirSemiAnnualReviewPeriodStart: sentinel(original?.tirSemiAnnualReviewPeriodStart),
    tirSemiAnnualReviewPeriodEnd: sentinel(original?.tirSemiAnnualReviewPeriodEnd),
    tirSemiAnnualSubmission: sentinel(original?.tirSemiAnnualSubmission),
    tirSemiAnnualReview: sentinel(original?.tirSemiAnnualReview),
    lastAuditFiscalYear: hasYearField
      ? form.lastAuditFiscalYear || null
      : (original?.lastAuditFiscalYear ?? null),
    lastCompensationStudy: dateValue('lastCompensationStudy'),
    bondIssuedDate: dateValue('bondIssuedDate'),
  });
}

function deriveVariant(
  chapter: AppointmentChapterType,
  appointmentType: AppointmentType,
): PastKeyDatesVariant {
  if (isChapter11SubchapterV(chapter, appointmentType)) {
    return 'chapter11-subv';
  }
  if (isChapter13Standing(chapter, appointmentType)) return 'chapter13-standing';
  return 'chapter12-standing';
}

export default function PastKeyDatesForm() {
  const fiscalYearOptions = buildYearOptions('backward', 21);
  const { trusteeId, appointmentId } = useParams<{
    trusteeId: string;
    appointmentId: string;
  }>();

  const [variant, setVariant] = useState<PastKeyDatesVariant>('chapter12-standing');

  const shell = useKeyDatesFormShell<PastKeyDatesFormState>({
    emptyForm: EMPTY_FORM,
    mapDataToForm: (data) => ({
      pastBackgroundQuestion: data.pastBackgroundQuestion ?? '',
      pastFieldExam: data.pastFieldExam ?? '',
      pastAudit: data.pastAudit ?? '',
      pastTprSubmission: data.pastTprSubmission ?? '',
      lastMonthlyReportReceived: data.lastMonthlyReportReceived ?? '',
      lastCompensationStudy: data.lastCompensationStudy ?? '',
      bondIssuedDate: data.bondIssuedDate ?? '',
      lastAuditFiscalYear: data.lastAuditFiscalYear ?? '',
    }),
    buildInput: (ids, original, form) => {
      const activeFields = PAST_KEY_DATES_FIELD_CONFIG[variant];
      const activeDateKeys = new Set(
        activeFields
          .filter((field) => field.kind === 'date' || field.kind === 'month-year')
          .map((field) => field.key),
      );
      const hasYearField = activeFields.some((field) => field.kind === 'year');
      return buildUpcomingKeyDatesInput(ids, original, form, { activeDateKeys, hasYearField });
    },
    errorLabel: 'past key dates',
    extraLoad: () =>
      Api2.getTrusteeAppointments(trusteeId!).then((response) => {
        const appointment = response.data?.find((a) => a.id === appointmentId);
        if (appointment) {
          setVariant(deriveVariant(appointment.chapter, appointment.appointmentType));
        }
      }),
  });

  function handleDateChange(field: PastDateFieldKey) {
    return (ev: React.ChangeEvent<HTMLInputElement>) => {
      shell.setForm((prev) => ({ ...prev, [field]: ev.target.value }));
    };
  }

  const activeDateFieldIds = PAST_KEY_DATES_FIELD_CONFIG[variant]
    .filter((field) => field.kind === 'date' || field.kind === 'month-year')
    .map((field) => field.inputId);
  const hasAnyDateError = shell.hasErrorAmong(activeDateFieldIds);

  return (
    <KeyDatesFormShell
      loadingId="edit-past-key-dates-loading"
      forbiddenMessage="You do not have permission to manage Trustee Past Key Dates"
      containerTestId="edit-past-key-dates"
      title={PAST_KEY_DATES_VARIANT_LABELS[variant].editHeading}
      idBase="past-key-dates"
      withTestIds
      isLoading={shell.isLoading}
      canManage={shell.canManage}
      isSaving={shell.isSaving}
      isSaveDisabled={hasAnyDateError}
      onSave={shell.handleSave}
      onCancel={shell.handleCancel}
    >
      {PAST_KEY_DATES_FIELD_CONFIG[variant].map((field) =>
        field.kind === 'year' ? (
          <Select
            key={field.inputId}
            id={field.inputId}
            label={field.formLabel}
            ariaDescription={field.hint}
            placeholder="- Select -"
            options={fiscalYearOptions.map((year) => ({
              value: String(year),
              label: String(year),
            }))}
            value={
              shell.form.lastAuditFiscalYear === '' ? '' : String(shell.form.lastAuditFiscalYear)
            }
            onChange={(ev) => {
              const val = ev.target.value;
              shell.setForm((prev) => ({ ...prev, lastAuditFiscalYear: val ? Number(val) : '' }));
            }}
          />
        ) : field.kind === 'month-year' ? (
          <MonthYearSelector
            key={field.inputId}
            id={field.inputId}
            label={field.formLabel}
            value={shell.form[field.key]}
            onChange={(val) => shell.setForm((prev) => ({ ...prev, [field.key]: val }))}
            onValidationChange={(hasError) => shell.registerFieldError(field.inputId, hasError)}
          />
        ) : (
          <DatePicker
            key={field.inputId}
            id={field.inputId}
            label={field.formLabel}
            value={shell.form[field.key]}
            onChange={handleDateChange(field.key)}
            onValidationChange={(hasError) => shell.registerFieldError(field.inputId, hasError)}
            disableMax
          />
        ),
      )}
    </KeyDatesFormShell>
  );
}
