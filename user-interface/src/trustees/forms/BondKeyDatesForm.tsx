import './EditUpcomingKeyDates.scss';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
} from '@common/cams/trustee-upcoming-key-dates';
import { mergeKeyDatesInput } from './keyDatesInput';
import DatePicker from '@/lib/components/uswds/DatePicker';
import { useKeyDatesFormShell } from './useKeyDatesFormShell';
import { KeyDatesFormShell } from './KeyDatesFormShell';

type BondKeyDatesFormState = {
  bondIssuedDate: string;
  bondRenewalDate: string;
};

const EMPTY_FORM: BondKeyDatesFormState = {
  bondIssuedDate: '',
  bondRenewalDate: '',
};

export function buildBondKeyDatesInput(
  ids: { trusteeId: string; appointmentId: string },
  original: TrusteeUpcomingKeyDates | null,
  form: BondKeyDatesFormState,
): TrusteeUpcomingKeyDatesInput {
  return mergeKeyDatesInput(ids, original, {
    bondIssuedDate: form.bondIssuedDate || null,
    bondRenewalDate: form.bondRenewalDate || null,
  });
}

export default function BondKeyDatesForm() {
  const shell = useKeyDatesFormShell<BondKeyDatesFormState>({
    emptyForm: EMPTY_FORM,
    mapDataToForm: (data) => ({
      bondIssuedDate: data.bondIssuedDate ?? '',
      bondRenewalDate: data.bondRenewalDate ?? '',
    }),
    buildInput: buildBondKeyDatesInput,
    errorLabel: 'bond key dates',
  });

  function handleDateChange(field: keyof BondKeyDatesFormState) {
    return (ev: React.ChangeEvent<HTMLInputElement>) => {
      shell.setForm((prev) => ({ ...prev, [field]: ev.target.value }));
    };
  }

  const hasAnyDateError = shell.hasErrorAmong(['bond-issued-date', 'bond-renewal-date']);

  return (
    <KeyDatesFormShell
      loadingId="edit-bond-key-dates-loading"
      forbiddenMessage="You do not have permission to manage Trustee Bond Key Dates"
      containerTestId="edit-bond-key-dates"
      title="Edit Bond Key Dates"
      idBase="bond-key-dates"
      withTestIds
      isLoading={shell.isLoading}
      canManage={shell.canManage}
      isSaving={shell.isSaving}
      isSaveDisabled={hasAnyDateError}
      onSave={shell.handleSave}
      onCancel={shell.handleCancel}
    >
      <DatePicker
        id="bond-renewal-date"
        label="Bond Renewal Date"
        value={shell.form.bondRenewalDate}
        onChange={handleDateChange('bondRenewalDate')}
        onValidationChange={(hasError) => shell.registerFieldError('bond-renewal-date', hasError)}
        disableMax
      />
      <DatePicker
        id="bond-issued-date"
        label="Bond Issued Date"
        value={shell.form.bondIssuedDate}
        onChange={handleDateChange('bondIssuedDate')}
        onValidationChange={(hasError) => shell.registerFieldError('bond-issued-date', hasError)}
        disableMax
      />
    </KeyDatesFormShell>
  );
}
