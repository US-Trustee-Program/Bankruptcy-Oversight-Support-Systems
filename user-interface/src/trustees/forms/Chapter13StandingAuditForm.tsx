import './Chapter13StandingAuditForm.scss';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
} from '@common/cams/trustee-upcoming-key-dates';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import DatePicker from '@/lib/components/uswds/DatePicker';
import useDateFieldErrors from '@/lib/hooks/UseDateFieldErrors';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import { Stop } from '@/lib/components/Stop';
import { buildKeyDatesInputFromOriginal } from './keyDatesInputDefaults';
import CompletionStatusYearSelect from './CompletionStatusYearSelect';

type FormState = {
  pastAudit: string;
  ch13AuditCompletionYear: number | '';
  ch13AuditCompletionStatus: 'Complete' | 'Incomplete' | '';
};

const EMPTY_FORM: FormState = {
  pastAudit: '',
  ch13AuditCompletionYear: '',
  ch13AuditCompletionStatus: '',
};

function buildFormStateFromData(data: TrusteeUpcomingKeyDates): FormState {
  return {
    pastAudit: data.pastAudit ?? '',
    ch13AuditCompletionYear: data.ch13AuditCompletionYear ?? '',
    ch13AuditCompletionStatus: data.ch13AuditCompletionStatus ?? '',
  };
}

function buildInput(
  trusteeId: string,
  appointmentId: string,
  original: TrusteeUpcomingKeyDates | null,
  form: FormState,
): TrusteeUpcomingKeyDatesInput {
  return {
    ...buildKeyDatesInputFromOriginal(trusteeId, appointmentId, original),
    pastAudit: form.pastAudit || null,
    ch13AuditCompletionYear: form.ch13AuditCompletionYear || null,
    ch13AuditCompletionStatus: form.ch13AuditCompletionStatus || null,
  };
}

export default function Chapter13StandingAuditForm() {
  const { trusteeId, appointmentId } = useParams<{
    trusteeId: string;
    appointmentId: string;
  }>();
  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();
  const canManage = !!LocalStorage.getSession()?.user?.roles?.includes(CamsRole.TrusteeAdmin);
  const { registerFieldError, hasErrorAmong } = useDateFieldErrors();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [original, setOriginal] = useState<TrusteeUpcomingKeyDates | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    Api2.getUpcomingKeyDates(trusteeId!, appointmentId!)
      .then((response) => {
        setOriginal(response.data);
        if (response.data) {
          setForm(buildFormStateFromData(response.data));
        }
      })
      .catch((err) => {
        globalAlert?.error(`Failed to load Audit key dates: ${(err as Error).message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trusteeId, appointmentId]);

  function handleCancel() {
    navigate(`/trustees/${trusteeId}/appointments`);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const input = buildInput(trusteeId!, appointmentId!, original, form);
      await Api2.putUpcomingKeyDates(trusteeId!, appointmentId!, input);
      navigate(`/trustees/${trusteeId}/appointments`);
    } catch (err) {
      globalAlert?.error(`Failed to save Audit key dates: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <LoadingSpinner id="edit-chapter13-standing-audit-key-dates-loading" />;
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

  const isCompletionPairIncomplete =
    (!!form.ch13AuditCompletionYear && !form.ch13AuditCompletionStatus) ||
    (!form.ch13AuditCompletionYear && !!form.ch13AuditCompletionStatus);

  const isSaveDisabled = isSaving || hasErrorAmong(['past-audit']) || isCompletionPairIncomplete;

  return (
    <div
      className="edit-chapter13-standing-audit-key-dates"
      data-testid="edit-chapter13-standing-audit-key-dates"
    >
      <h3>Edit Audit Key Dates</h3>
      <DatePicker
        id="past-audit"
        label="Audit Report Date"
        value={form.pastAudit}
        disableMax
        onChange={(e) => setForm((prev) => ({ ...prev, pastAudit: e.target.value }))}
        onValidationChange={(hasError) => registerFieldError('past-audit', hasError)}
      />
      <CompletionStatusYearSelect
        idPrefix="audit-completion"
        title="Audit Completion Status for Year"
        year={form.ch13AuditCompletionYear}
        status={form.ch13AuditCompletionStatus}
        onYearChange={(ch13AuditCompletionYear) =>
          setForm((prev) => ({ ...prev, ch13AuditCompletionYear }))
        }
        onStatusChange={(ch13AuditCompletionStatus) =>
          setForm((prev) => ({ ...prev, ch13AuditCompletionStatus }))
        }
      />
      <div className="usa-button-group">
        <Button
          id="save-chapter13-standing-audit-key-dates"
          onClick={handleSave}
          disabled={isSaveDisabled}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id="cancel-chapter13-standing-audit-key-dates"
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
