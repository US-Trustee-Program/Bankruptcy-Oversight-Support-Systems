import './EditUpcomingKeyDates.scss';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
} from '@common/cams/trustee-upcoming-key-dates';
import { mergeKeyDatesInput } from './chapter7PanelKeyDatesInput';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import DatePicker from '@/lib/components/uswds/DatePicker';
import useDateFieldErrors from '@/lib/hooks/UseDateFieldErrors';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { Stop } from '@/lib/components/Stop';

type Chapter12StandingOtherKeyDatesFormState = {
  leaseExpiration: string;
  pastBackgroundQuestion: string;
  idExpiration: string;
};

const EMPTY_FORM: Chapter12StandingOtherKeyDatesFormState = {
  leaseExpiration: '',
  pastBackgroundQuestion: '',
  idExpiration: '',
};

export function buildOtherKeyDatesInput(
  ids: { trusteeId: string; appointmentId: string },
  original: TrusteeUpcomingKeyDates | null,
  form: Chapter12StandingOtherKeyDatesFormState,
): TrusteeUpcomingKeyDatesInput {
  return mergeKeyDatesInput(ids, original, {
    leaseExpiration: form.leaseExpiration || null,
    pastBackgroundQuestion: form.pastBackgroundQuestion || null,
    idExpiration: form.idExpiration || null,
  });
}

export default function Chapter12StandingOtherKeyDatesForm() {
  const { trusteeId, appointmentId } = useParams<{
    trusteeId: string;
    appointmentId: string;
  }>();
  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();
  const canManage = useCanManageTrustees();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<Chapter12StandingOtherKeyDatesFormState>(EMPTY_FORM);
  const [original, setOriginal] = useState<TrusteeUpcomingKeyDates | null>(null);
  const { registerFieldError, hasErrorAmong } = useDateFieldErrors();

  useEffect(() => {
    Api2.getUpcomingKeyDates(trusteeId!, appointmentId!)
      .then((response) => {
        const data = response.data;
        if (data) {
          setOriginal(data);
          setForm({
            leaseExpiration: data.leaseExpiration ?? '',
            pastBackgroundQuestion: data.pastBackgroundQuestion ?? '',
            idExpiration: data.idExpiration ?? '',
          });
        }
      })
      .catch((err) => {
        globalAlert?.error(`Failed to load Other key dates: ${(err as Error).message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [trusteeId, appointmentId]);

  function handleFieldChange(field: keyof Chapter12StandingOtherKeyDatesFormState) {
    return (ev: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: ev.target.value }));
    };
  }

  async function handleSave() {
    setIsSaving(true);
    const input = buildOtherKeyDatesInput(
      { trusteeId: trusteeId!, appointmentId: appointmentId! },
      original,
      form,
    );

    try {
      await Api2.putUpcomingKeyDates(trusteeId!, appointmentId!, input);
      navigate(`/trustees/${trusteeId}/appointments`);
    } catch (err) {
      globalAlert?.error(`Failed to save Other key dates: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    navigate(`/trustees/${trusteeId}/appointments`);
  }

  if (isLoading) {
    return <LoadingSpinner id="edit-chapter12-standing-other-loading" />;
  }

  if (!canManage) {
    return (
      <Stop
        id="forbidden-alert"
        title="Forbidden"
        message="You do not have permission to manage Other Key Dates"
        asError
      />
    );
  }

  const isSaveDisabled =
    isSaving || hasErrorAmong(['lease-expiration', 'past-background-question', 'id-expiration']);

  return (
    <div className="edit-upcoming-key-dates" data-testid="edit-chapter12-standing-other">
      <h3>Edit Other Key Dates</h3>

      <DatePicker
        id="lease-expiration"
        label="Lease Expiration"
        value={form.leaseExpiration}
        onChange={handleFieldChange('leaseExpiration')}
        onValidationChange={(hasError) => registerFieldError('lease-expiration', hasError)}
        disableMax
      />

      <DatePicker
        id="past-background-question"
        label="Last Update to Background Questionnaire"
        value={form.pastBackgroundQuestion}
        onChange={handleFieldChange('pastBackgroundQuestion')}
        onValidationChange={(hasError) => registerFieldError('past-background-question', hasError)}
        disableMax
      />

      <DatePicker
        id="id-expiration"
        label="ID Expiration"
        value={form.idExpiration}
        onChange={handleFieldChange('idExpiration')}
        onValidationChange={(hasError) => registerFieldError('id-expiration', hasError)}
        disableMax
      />

      <div className="usa-button-group">
        <Button
          id="save-chapter12-standing-other"
          data-testid="button-save-chapter12-standing-other"
          onClick={handleSave}
          disabled={isSaveDisabled}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id="cancel-chapter12-standing-other"
          data-testid="button-cancel-chapter12-standing-other"
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
