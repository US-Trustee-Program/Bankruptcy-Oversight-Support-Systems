import './EditUpcomingKeyDates.scss';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
  validateCompletionPairPresence,
} from '@common/cams/trustee-upcoming-key-dates';
import { mergeKeyDatesInput, FISCAL_YEAR_OPTIONS } from './chapter7PanelKeyDatesInput';
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

type AuditCompletionStatus = 'CLOSED' | 'NOT_CLOSED';

type Chapter12StandingAuditFormState = {
  pastAudit: string;
  lastAuditFiscalYear: number | '';
  auditCompletionYear: number | '';
  auditCompletionStatus: AuditCompletionStatus | '';
};

const EMPTY_FORM: Chapter12StandingAuditFormState = {
  pastAudit: '',
  lastAuditFiscalYear: '',
  auditCompletionYear: '',
  auditCompletionStatus: '',
};

export function buildAuditKeyDatesInput(
  ids: { trusteeId: string; appointmentId: string },
  original: TrusteeUpcomingKeyDates | null,
  form: Chapter12StandingAuditFormState,
): TrusteeUpcomingKeyDatesInput {
  return mergeKeyDatesInput(ids, original, {
    pastAudit: form.pastAudit || null,
    lastAuditFiscalYear: form.lastAuditFiscalYear !== '' ? form.lastAuditFiscalYear : null,
    auditCompletionYear: form.auditCompletionYear !== '' ? form.auditCompletionYear : null,
    auditCompletionStatus: form.auditCompletionStatus || null,
  });
}

export default function Chapter12StandingAuditForm() {
  const { trusteeId, appointmentId } = useParams<{
    trusteeId: string;
    appointmentId: string;
  }>();
  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();
  const canManage = useCanManageTrustees();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [form, setForm] = useState<Chapter12StandingAuditFormState>(EMPTY_FORM);
  const [original, setOriginal] = useState<TrusteeUpcomingKeyDates | null>(null);
  const { registerFieldError, hasErrorAmong } = useDateFieldErrors();
  const completionGroup = useGroupBlur();

  useEffect(() => {
    Api2.getUpcomingKeyDates(trusteeId!, appointmentId!)
      .then((response) => {
        const data = response.data;
        if (data) {
          setOriginal(data);
          setForm({
            pastAudit: data.pastAudit ?? '',
            lastAuditFiscalYear: data.lastAuditFiscalYear ?? '',
            auditCompletionYear: data.auditCompletionYear ?? '',
            auditCompletionStatus: data.auditCompletionStatus ?? '',
          });
        }
      })
      .catch((err) => {
        // A failed GET must block Save: `original` stays null here, same as the
        // legitimate "no document yet" case, but saving would wipe every
        // unrelated key-date field on the shared document via mergeKeyDatesInput.
        setLoadFailed(true);
        globalAlert?.error(`Failed to load Audit key dates: ${(err as Error).message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [trusteeId, appointmentId]);

  function handleDateChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, pastAudit: ev.target.value }));
  }

  async function handleSave() {
    setIsSaving(true);
    const input = buildAuditKeyDatesInput(
      { trusteeId: trusteeId!, appointmentId: appointmentId! },
      original,
      form,
    );

    try {
      await Api2.putUpcomingKeyDates(trusteeId!, appointmentId!, input);
      navigate(`/trustees/${trusteeId}/appointments`);
    } catch (err) {
      globalAlert?.error(`Failed to save Audit key dates: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    navigate(`/trustees/${trusteeId}/appointments`);
  }

  if (isLoading) {
    return <LoadingSpinner id="edit-chapter12-standing-audit-loading" />;
  }

  if (!canManage) {
    return (
      <Stop
        id="forbidden-alert"
        title="Forbidden"
        message="You do not have permission to manage Trustee Audit Key Dates"
        asError
      />
    );
  }

  const hasAnyDateError = hasErrorAmong(['past-audit']);
  const completionPairError = validateCompletionPairPresence(
    form.auditCompletionYear,
    form.auditCompletionStatus,
    'Audit Completion Status',
  );
  const completionPairErrorId = 'audit-completion-status-error';

  return (
    <div className="edit-upcoming-key-dates" data-testid="edit-chapter12-standing-audit">
      <h3>Edit Audit Key Dates</h3>

      <DatePicker
        id="past-audit"
        label="Audit Report Date"
        value={form.pastAudit}
        onChange={handleDateChange}
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

      <div className="exam-audit-group">
        <p className="usa-label">Audit Completion Status for Year</p>
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
              { value: 'CLOSED', label: 'Closed' },
              { value: 'NOT_CLOSED', label: 'Not Closed' },
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
          id="save-chapter12-standing-audit"
          data-testid="button-save-chapter12-standing-audit"
          onClick={handleSave}
          disabled={isSaving || loadFailed || hasAnyDateError || !!completionPairError}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id="cancel-chapter12-standing-audit"
          data-testid="button-cancel-chapter12-standing-audit"
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
