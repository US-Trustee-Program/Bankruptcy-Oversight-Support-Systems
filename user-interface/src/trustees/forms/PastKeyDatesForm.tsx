import './EditUpcomingKeyDates.scss';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { buildYearOptions, mergeKeyDatesInput } from './keyDatesInput';
import DatePicker from '@/lib/components/uswds/DatePicker';
import MonthYearSelector from '@/lib/components/uswds/MonthYearSelector';
import Select from '@/lib/components/uswds/Select';
import useDateFieldErrors from '@/lib/hooks/UseDateFieldErrors';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { Stop } from '@/lib/components/Stop';

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
  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();
  const canManage = useCanManageTrustees();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [variant, setVariant] = useState<PastKeyDatesVariant>('chapter12-standing');
  const [form, setForm] = useState<PastKeyDatesFormState>(EMPTY_FORM);
  const [original, setOriginal] = useState<TrusteeUpcomingKeyDates | null>(null);
  const { registerFieldError, hasErrorAmong } = useDateFieldErrors();

  useEffect(() => {
    Promise.all([
      Api2.getUpcomingKeyDates(trusteeId!, appointmentId!),
      Api2.getTrusteeAppointments(trusteeId!),
    ])
      .then(([keyDatesResponse, appointmentsResponse]) => {
        const data = keyDatesResponse.data;
        if (data) {
          setOriginal(data);
          setForm({
            pastBackgroundQuestion: data.pastBackgroundQuestion ?? '',
            pastFieldExam: data.pastFieldExam ?? '',
            pastAudit: data.pastAudit ?? '',
            pastTprSubmission: data.pastTprSubmission ?? '',
            lastMonthlyReportReceived: data.lastMonthlyReportReceived ?? '',
            lastCompensationStudy: data.lastCompensationStudy ?? '',
            bondIssuedDate: data.bondIssuedDate ?? '',
            lastAuditFiscalYear: data.lastAuditFiscalYear ?? '',
          });
        }
        const appointment = appointmentsResponse.data?.find((a) => a.id === appointmentId);
        if (appointment) {
          setVariant(deriveVariant(appointment.chapter, appointment.appointmentType));
        }
      })
      .catch((err) => {
        globalAlert?.error(`Failed to load past key dates: ${(err as Error).message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [trusteeId, appointmentId]);

  function handleDateChange(field: PastDateFieldKey) {
    return (ev: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: ev.target.value }));
    };
  }

  async function handleSave() {
    setIsSaving(true);
    const activeFields = PAST_KEY_DATES_FIELD_CONFIG[variant];
    const activeDateKeys = new Set(
      activeFields
        .filter((field) => field.kind === 'date' || field.kind === 'month-year')
        .map((field) => field.key),
    );
    const hasYearField = activeFields.some((field) => field.kind === 'year');
    const isoInput = buildUpcomingKeyDatesInput(
      { trusteeId: trusteeId!, appointmentId: appointmentId! },
      original,
      form,
      { activeDateKeys, hasYearField },
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

  if (!canManage) {
    return (
      <Stop
        id="forbidden-alert"
        title="Forbidden"
        message="You do not have permission to manage Trustee Past Key Dates"
        asError
      />
    );
  }

  const activeDateFieldIds = PAST_KEY_DATES_FIELD_CONFIG[variant]
    .filter((field) => field.kind === 'date' || field.kind === 'month-year')
    .map((field) => field.inputId);
  const hasAnyDateError = hasErrorAmong(activeDateFieldIds);

  return (
    <div className="edit-upcoming-key-dates" data-testid="edit-past-key-dates">
      <h3>{PAST_KEY_DATES_VARIANT_LABELS[variant].editHeading}</h3>
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
            value={form.lastAuditFiscalYear === '' ? '' : String(form.lastAuditFiscalYear)}
            onChange={(ev) => {
              const val = ev.target.value;
              setForm((prev) => ({ ...prev, lastAuditFiscalYear: val ? Number(val) : '' }));
            }}
          />
        ) : field.kind === 'month-year' ? (
          <MonthYearSelector
            key={field.inputId}
            id={field.inputId}
            label={field.formLabel}
            value={form[field.key]}
            onChange={(val) => setForm((prev) => ({ ...prev, [field.key]: val }))}
            onValidationChange={(hasError) => registerFieldError(field.inputId, hasError)}
          />
        ) : (
          <DatePicker
            key={field.inputId}
            id={field.inputId}
            label={field.formLabel}
            value={form[field.key]}
            onChange={handleDateChange(field.key)}
            onValidationChange={(hasError) => registerFieldError(field.inputId, hasError)}
            disableMax
          />
        ),
      )}
      <div className="usa-button-group">
        <Button
          id="save-past-key-dates"
          data-testid="button-save-past-key-dates"
          onClick={handleSave}
          disabled={isSaving || hasAnyDateError}
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
