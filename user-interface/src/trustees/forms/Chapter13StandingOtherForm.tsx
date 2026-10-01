import './Chapter13StandingOtherForm.scss';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
} from '@common/cams/trustee-upcoming-key-dates';
import DatePicker from '@/lib/components/uswds/DatePicker';
import MonthYearSelector from '@/lib/components/uswds/MonthYearSelector';
import { buildKeyDatesInputFromOriginal } from './keyDatesInputDefaults';
import { useKeyDatesFormShell } from './useKeyDatesFormShell';
import { KeyDatesFormShell } from './KeyDatesFormShell';

type FormState = {
  leaseExpiration: string;
  pastBackgroundQuestion: string;
  idExpiration: string;
  lastCompensationStudy: string;
};

const EMPTY_FORM: FormState = {
  leaseExpiration: '',
  pastBackgroundQuestion: '',
  idExpiration: '',
  lastCompensationStudy: '',
};

function buildFormStateFromData(data: TrusteeUpcomingKeyDates): FormState {
  return {
    leaseExpiration: data.leaseExpiration ?? '',
    pastBackgroundQuestion: data.pastBackgroundQuestion ?? '',
    idExpiration: data.idExpiration ?? '',
    lastCompensationStudy: data.lastCompensationStudy ?? '',
  };
}

function buildInput(
  ids: { trusteeId: string; appointmentId: string },
  original: TrusteeUpcomingKeyDates | null,
  form: FormState,
): TrusteeUpcomingKeyDatesInput {
  return {
    ...buildKeyDatesInputFromOriginal(ids.trusteeId, ids.appointmentId, original),
    pastBackgroundQuestion: form.pastBackgroundQuestion || null,
    leaseExpiration: form.leaseExpiration || null,
    idExpiration: form.idExpiration || null,
    lastCompensationStudy: form.lastCompensationStudy || null,
  };
}

export default function Chapter13StandingOtherForm() {
  const shell = useKeyDatesFormShell<FormState>({
    emptyForm: EMPTY_FORM,
    mapDataToForm: buildFormStateFromData,
    buildInput,
    errorLabel: 'Other key dates',
  });

  const isSaveDisabled =
    shell.loadFailed ||
    shell.hasErrorAmong([
      'lease-expiration',
      'past-background-question',
      'id-expiration',
      'last-compensation-study',
    ]);

  return (
    <KeyDatesFormShell
      loadingId="edit-chapter13-standing-other-key-dates-loading"
      forbiddenMessage="You do not have permission to manage Trustee Upcoming Key Dates"
      containerClassName="edit-chapter13-standing-other-key-dates"
      containerTestId="edit-chapter13-standing-other-key-dates"
      title="Edit Other Key Dates"
      idBase="chapter13-standing-other-key-dates"
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
        disableMax
        onChange={(e) => shell.setForm((prev) => ({ ...prev, leaseExpiration: e.target.value }))}
        onValidationChange={(hasError) => shell.registerFieldError('lease-expiration', hasError)}
      />
      <DatePicker
        id="past-background-question"
        label="Last Update to Background Questionnaire"
        value={shell.form.pastBackgroundQuestion}
        disableMax
        onChange={(e) =>
          shell.setForm((prev) => ({ ...prev, pastBackgroundQuestion: e.target.value }))
        }
        onValidationChange={(hasError) =>
          shell.registerFieldError('past-background-question', hasError)
        }
      />
      <DatePicker
        id="id-expiration"
        label="ID Expiration"
        value={shell.form.idExpiration}
        disableMax
        onChange={(e) => shell.setForm((prev) => ({ ...prev, idExpiration: e.target.value }))}
        onValidationChange={(hasError) => shell.registerFieldError('id-expiration', hasError)}
      />
      <MonthYearSelector
        id="last-compensation-study"
        label="Last Compensation Study"
        value={shell.form.lastCompensationStudy}
        onChange={(val) => shell.setForm((prev) => ({ ...prev, lastCompensationStudy: val }))}
        onValidationChange={(hasError) =>
          shell.registerFieldError('last-compensation-study', hasError)
        }
      />
    </KeyDatesFormShell>
  );
}
