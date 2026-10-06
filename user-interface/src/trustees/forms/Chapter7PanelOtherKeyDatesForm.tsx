import './EditUpcomingKeyDates.scss';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
} from '@common/cams/trustee-upcoming-key-dates';
import { mergeKeyDatesInput } from './keyDatesInput';
import DatePicker from '@/lib/components/uswds/DatePicker';
import { useKeyDatesFormShell } from './useKeyDatesFormShell';
import { KeyDatesFormShell } from './KeyDatesFormShell';

type Chapter7PanelOtherKeyDatesFormState = {
  pastBackgroundQuestion: string;
};

const EMPTY_FORM: Chapter7PanelOtherKeyDatesFormState = {
  pastBackgroundQuestion: '',
};

export function buildOtherKeyDatesInput(
  ids: { trusteeId: string; appointmentId: string },
  original: TrusteeUpcomingKeyDates | null,
  form: Chapter7PanelOtherKeyDatesFormState,
): TrusteeUpcomingKeyDatesInput {
  return mergeKeyDatesInput(ids, original, {
    pastBackgroundQuestion: form.pastBackgroundQuestion || null,
  });
}

export default function Chapter7PanelOtherKeyDatesForm() {
  const shell = useKeyDatesFormShell<Chapter7PanelOtherKeyDatesFormState>({
    emptyForm: EMPTY_FORM,
    mapDataToForm: (data) => ({
      pastBackgroundQuestion: data.pastBackgroundQuestion ?? '',
    }),
    buildInput: buildOtherKeyDatesInput,
    errorLabel: 'Other key dates',
  });

  const isSaveDisabled = shell.loadFailed || shell.hasErrorAmong(['past-background-question']);

  return (
    <KeyDatesFormShell
      loadingId="edit-chapter7-panel-other-loading"
      forbiddenMessage="You do not have permission to manage Other Key Dates"
      containerTestId="edit-chapter7-panel-other"
      title="Edit Other Key Dates"
      idBase="chapter7-panel-other"
      withTestIds
      isLoading={shell.isLoading}
      canManage={shell.canManage}
      isSaving={shell.isSaving}
      isSaveDisabled={isSaveDisabled}
      onSave={shell.handleSave}
      onCancel={shell.handleCancel}
    >
      <DatePicker
        id="past-background-question"
        label="Last Update to Background Questionnaire"
        value={shell.form.pastBackgroundQuestion}
        onChange={(e) =>
          shell.setForm((prev) => ({ ...prev, pastBackgroundQuestion: e.target.value }))
        }
        onValidationChange={(hasError) =>
          shell.registerFieldError('past-background-question', hasError)
        }
        disableMax
      />
    </KeyDatesFormShell>
  );
}
