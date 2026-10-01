import './EditUpcomingKeyDates.scss';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
} from '@common/cams/trustee-upcoming-key-dates';
import { mergeKeyDatesInput } from './keyDatesInput';
import DatePicker from '@/lib/components/uswds/DatePicker';
import { useKeyDatesFormShell } from './useKeyDatesFormShell';
import { KeyDatesFormShell } from './KeyDatesFormShell';

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
  const shell = useKeyDatesFormShell<Chapter12StandingOtherKeyDatesFormState>({
    emptyForm: EMPTY_FORM,
    mapDataToForm: (data) => ({
      leaseExpiration: data.leaseExpiration ?? '',
      pastBackgroundQuestion: data.pastBackgroundQuestion ?? '',
      idExpiration: data.idExpiration ?? '',
    }),
    buildInput: buildOtherKeyDatesInput,
    errorLabel: 'Other key dates',
  });

  function handleFieldChange(field: keyof Chapter12StandingOtherKeyDatesFormState) {
    return (ev: React.ChangeEvent<HTMLInputElement>) => {
      shell.setForm((prev) => ({ ...prev, [field]: ev.target.value }));
    };
  }

  const isSaveDisabled =
    shell.loadFailed ||
    shell.hasErrorAmong(['lease-expiration', 'past-background-question', 'id-expiration']);

  return (
    <KeyDatesFormShell
      loadingId="edit-chapter12-standing-other-loading"
      forbiddenMessage="You do not have permission to manage Other Key Dates"
      containerTestId="edit-chapter12-standing-other"
      title="Edit Other Key Dates"
      idBase="chapter12-standing-other"
      withTestIds
      isLoading={shell.isLoading}
      canManage={shell.canManage}
      isSaving={shell.isSaving}
      isSaveDisabled={isSaveDisabled}
      onSave={shell.handleSave}
      onCancel={shell.handleCancel}
    >
      <DatePicker
        id="lease-expiration"
        label="Lease Expiration"
        value={shell.form.leaseExpiration}
        onChange={handleFieldChange('leaseExpiration')}
        onValidationChange={(hasError) => shell.registerFieldError('lease-expiration', hasError)}
        disableMax
      />

      <DatePicker
        id="past-background-question"
        label="Last Update to Background Questionnaire"
        value={shell.form.pastBackgroundQuestion}
        onChange={handleFieldChange('pastBackgroundQuestion')}
        onValidationChange={(hasError) =>
          shell.registerFieldError('past-background-question', hasError)
        }
        disableMax
      />

      <DatePicker
        id="id-expiration"
        label="ID Expiration"
        value={shell.form.idExpiration}
        onChange={handleFieldChange('idExpiration')}
        onValidationChange={(hasError) => shell.registerFieldError('id-expiration', hasError)}
        disableMax
      />
    </KeyDatesFormShell>
  );
}
