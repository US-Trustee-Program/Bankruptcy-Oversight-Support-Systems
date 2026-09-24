import './EditUpcomingKeyDates.scss';
import '@/lib/components/uswds/forms.scss';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
  validateCompletionPairPresence,
} from '@common/cams/trustee-upcoming-key-dates';
import {
  mergeKeyDatesInput,
  CURRENT_YEAR,
  FISCAL_YEAR_OPTIONS,
} from './chapter7PanelKeyDatesInput';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import DatePicker from '@/lib/components/uswds/DatePicker';
import Select from '@/lib/components/uswds/Select';
import useDateFieldErrors from '@/lib/hooks/UseDateFieldErrors';
import useGroupBlur from '@/lib/hooks/UseGroupBlur';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { Stop } from '@/lib/components/Stop';

const UPCOMING_YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR + i);

type AuditCompletionStatus = 'CLOSED' | 'NOT_CLOSED';

type Chapter7PanelAuditFieldExamFormState = {
  upcomingExamOrAuditYear: number | '';
  upcomingExamOrAuditType: 'Field Exam' | 'Audit' | '';
  pastAudit: string;
  lastAuditFiscalYear: number | '';
  pastFieldExam: string;
  auditCompletionYear: number | '';
  auditCompletionStatus: AuditCompletionStatus | '';
};

const EMPTY_FORM: Chapter7PanelAuditFieldExamFormState = {
  upcomingExamOrAuditYear: '',
  upcomingExamOrAuditType: '',
  pastAudit: '',
  lastAuditFiscalYear: '',
  pastFieldExam: '',
  auditCompletionYear: '',
  auditCompletionStatus: '',
};

export function buildAuditFieldExamKeyDatesInput(
  ids: { trusteeId: string; appointmentId: string },
  original: TrusteeUpcomingKeyDates | null,
  form: Chapter7PanelAuditFieldExamFormState,
): TrusteeUpcomingKeyDatesInput {
  return mergeKeyDatesInput(ids, original, {
    pastFieldExam: form.pastFieldExam || null,
    pastAudit: form.pastAudit || null,
    upcomingExamOrAuditYear:
      form.upcomingExamOrAuditYear !== '' ? form.upcomingExamOrAuditYear : null,
    upcomingExamOrAuditType: form.upcomingExamOrAuditType || null,
    lastAuditFiscalYear: form.lastAuditFiscalYear !== '' ? form.lastAuditFiscalYear : null,
    auditCompletionYear: form.auditCompletionYear !== '' ? form.auditCompletionYear : null,
    auditCompletionStatus: form.auditCompletionStatus || null,
  });
}

export default function Chapter7PanelAuditFieldExamForm() {
  const { trusteeId, appointmentId } = useParams<{
    trusteeId: string;
    appointmentId: string;
  }>();
  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();
  const canManage = useCanManageTrustees();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<Chapter7PanelAuditFieldExamFormState>(EMPTY_FORM);
  const [original, setOriginal] = useState<TrusteeUpcomingKeyDates | null>(null);
  const { registerFieldError, hasErrorAmong } = useDateFieldErrors();
  const examAuditGroup = useGroupBlur();
  const completionGroup = useGroupBlur();

  useEffect(() => {
    Api2.getUpcomingKeyDates(trusteeId!, appointmentId!)
      .then((response) => {
        const data = response.data;
        if (data) {
          setOriginal(data);
          setForm({
            upcomingExamOrAuditYear: data.upcomingExamOrAuditYear ?? '',
            upcomingExamOrAuditType: data.upcomingExamOrAuditType ?? '',
            pastAudit: data.pastAudit ?? '',
            lastAuditFiscalYear: data.lastAuditFiscalYear ?? '',
            pastFieldExam: data.pastFieldExam ?? '',
            auditCompletionYear: data.auditCompletionYear ?? '',
            auditCompletionStatus: data.auditCompletionStatus ?? '',
          });
        }
      })
      .catch((err) => {
        globalAlert?.error(`Failed to load Audit/Field Exam key dates: ${(err as Error).message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [trusteeId, appointmentId]);

  function handleDateChange(field: 'pastAudit' | 'pastFieldExam') {
    return (ev: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: ev.target.value }));
    };
  }

  async function handleSave() {
    setIsSaving(true);
    const input = buildAuditFieldExamKeyDatesInput(
      { trusteeId: trusteeId!, appointmentId: appointmentId! },
      original,
      form,
    );

    try {
      await Api2.putUpcomingKeyDates(trusteeId!, appointmentId!, input);
      navigate(`/trustees/${trusteeId}/appointments`);
    } catch (err) {
      globalAlert?.error(`Failed to save Audit/Field Exam key dates: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    navigate(`/trustees/${trusteeId}/appointments`);
  }

  if (isLoading) {
    return <LoadingSpinner id="edit-chapter7-panel-audit-field-exam-loading" />;
  }

  if (!canManage) {
    return (
      <Stop
        id="forbidden-alert"
        title="Forbidden"
        message="You do not have permission to manage Trustee Audit/Field Exam Key Dates"
        asError
      />
    );
  }

  const hasAnyDateError = hasErrorAmong(['past-audit', 'past-field-exam']);
  const examOrAuditPairError = validateCompletionPairPresence(
    form.upcomingExamOrAuditYear,
    form.upcomingExamOrAuditType,
    'Field Exam or Audit',
    { first: 'Year', second: 'Type' },
  );
  const examOrAuditPairErrorId = 'exam-audit-pair-error';
  const completionPairError = validateCompletionPairPresence(
    form.auditCompletionYear,
    form.auditCompletionStatus,
    'Field Exam/Audit Completion Status',
  );
  const completionPairErrorId = 'audit-completion-status-error';

  return (
    <div className="edit-upcoming-key-dates" data-testid="edit-chapter7-panel-audit-field-exam">
      <h3>Edit Audit/Field Exam Key Dates</h3>

      <div className="exam-audit-group">
        <p className="usa-label">Field Exam or Audit</p>
        <div
          className="exam-audit-group__row"
          onFocus={examAuditGroup.handleFocus}
          onBlur={examAuditGroup.handleBlur}
        >
          <Select
            id="upcoming-exam-audit-year"
            label="Year"
            compactLabel
            hasError={examAuditGroup.touched && !!examOrAuditPairError}
            ariaDescribedBy={
              examAuditGroup.touched && examOrAuditPairError ? examOrAuditPairErrorId : undefined
            }
            placeholder="- Select -"
            options={UPCOMING_YEAR_OPTIONS.map((y) => ({ value: String(y), label: String(y) }))}
            value={form.upcomingExamOrAuditYear === '' ? '' : String(form.upcomingExamOrAuditYear)}
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
            hasError={examAuditGroup.touched && !!examOrAuditPairError}
            ariaDescribedBy={
              examAuditGroup.touched && examOrAuditPairError ? examOrAuditPairErrorId : undefined
            }
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
        {examAuditGroup.touched && examOrAuditPairError && (
          <div
            className="cams-field-error-message"
            id={examOrAuditPairErrorId}
            data-testid={examOrAuditPairErrorId}
          >
            {examOrAuditPairError}
          </div>
        )}
      </div>

      <DatePicker
        id="past-audit"
        label="Audit Report Date"
        value={form.pastAudit}
        onChange={handleDateChange('pastAudit')}
        onValidationChange={(hasError) => registerFieldError('past-audit', hasError)}
        disableMax
      />

      <Select
        id="last-audit-fiscal-year"
        label="Last Audit's Fiscal Year"
        ariaDescription="The fiscal year of the TIR data audited"
        placeholder="- Select -"
        options={FISCAL_YEAR_OPTIONS.map((year) => ({ value: String(year), label: String(year) }))}
        value={form.lastAuditFiscalYear === '' ? '' : String(form.lastAuditFiscalYear)}
        onChange={(ev) => {
          const val = ev.target.value;
          setForm((prev) => ({ ...prev, lastAuditFiscalYear: val ? Number(val) : '' }));
        }}
      />

      <DatePicker
        id="past-field-exam"
        label="Field Exam Report Date"
        value={form.pastFieldExam}
        onChange={handleDateChange('pastFieldExam')}
        onValidationChange={(hasError) => registerFieldError('past-field-exam', hasError)}
        disableMax
      />

      <div className="exam-audit-group">
        <p className="usa-label">Field Exam/Audit Completion Status for Year</p>
        <div
          className="exam-audit-group__row"
          onFocus={completionGroup.handleFocus}
          onBlur={completionGroup.handleBlur}
        >
          <Select
            id="audit-completion-status-year"
            label="Year"
            compactLabel
            hasError={completionGroup.touched && !!completionPairError}
            ariaDescribedBy={
              completionGroup.touched && completionPairError ? completionPairErrorId : undefined
            }
            placeholder="- Select -"
            options={FISCAL_YEAR_OPTIONS.map((year) => ({
              value: String(year),
              label: String(year),
            }))}
            value={form.auditCompletionYear === '' ? '' : String(form.auditCompletionYear)}
            onChange={(e) => {
              const val = e.target.value;
              setForm((prev) => ({
                ...prev,
                auditCompletionYear: val ? Number(val) : '',
              }));
            }}
          />
          <Select
            id="audit-completion-status-status"
            label="Status"
            compactLabel
            hasError={completionGroup.touched && !!completionPairError}
            ariaDescribedBy={
              completionGroup.touched && completionPairError ? completionPairErrorId : undefined
            }
            placeholder="- Select -"
            options={[
              { value: 'CLOSED', label: 'Complete' },
              { value: 'NOT_CLOSED', label: 'Incomplete' },
            ]}
            value={form.auditCompletionStatus}
            onChange={(e) => {
              setForm((prev) => ({
                ...prev,
                auditCompletionStatus: e.target.value as AuditCompletionStatus | '',
              }));
            }}
          />
        </div>
        {completionGroup.touched && completionPairError && (
          <div
            className="cams-field-error-message"
            id={completionPairErrorId}
            data-testid={completionPairErrorId}
          >
            {completionPairError}
          </div>
        )}
      </div>

      <div className="usa-button-group">
        <Button
          id="save-chapter7-panel-audit-field-exam"
          data-testid="button-save-chapter7-panel-audit-field-exam"
          onClick={handleSave}
          disabled={isSaving || hasAnyDateError || !!examOrAuditPairError || !!completionPairError}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id="cancel-chapter7-panel-audit-field-exam"
          data-testid="button-cancel-chapter7-panel-audit-field-exam"
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
