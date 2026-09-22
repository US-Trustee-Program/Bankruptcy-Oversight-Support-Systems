import './EditUpcomingKeyDates.scss';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  validateTrusteeUpcomingKeyDates,
} from '@common/cams/trustee-upcoming-key-dates';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { Stop } from '@/lib/components/Stop';
import { mergeKeyDatesInput } from './chapter7PanelKeyDatesInput';
import CompletionStatusFields, { CompletionStatusValue } from './CompletionStatusFields';
import { resolveKeyDatesSaveError } from './keyDatesSaveError';

const EMPTY_COMPLETION: CompletionStatusValue = { year: '', status: '' };

// The validator checks the whole merged document, so save errors have to be
// sorted into this form's fields and everything else.
const OWNED_FIELDS = ['annualReportCompletionYear', 'annualReportCompletionStatus'] as const;

export default function AnnualReportKeyDatesForm() {
  const { trusteeId, appointmentId } = useParams<{
    trusteeId: string;
    appointmentId: string;
  }>();
  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();
  const canManage = useCanManageTrustees();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [completion, setCompletion] = useState<CompletionStatusValue>(EMPTY_COMPLETION);
  const [original, setOriginal] = useState<TrusteeUpcomingKeyDates | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Api2.getUpcomingKeyDates(trusteeId!, appointmentId!)
      .then((response) => {
        const data = response.data;
        if (data) {
          setOriginal(data);
          setCompletion({
            year: data.annualReportCompletionYear ?? '',
            status: data.annualReportCompletionStatus ?? '',
          });
        }
      })
      .catch((err) => {
        globalAlert?.error(`Failed to load annual report key dates: ${(err as Error).message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [trusteeId, appointmentId]);

  function buildInput() {
    return mergeKeyDatesInput({ trusteeId: trusteeId!, appointmentId: appointmentId! }, original, {
      annualReportCompletionYear: completion.year === '' ? null : completion.year,
      annualReportCompletionStatus: completion.status === '' ? null : completion.status,
    });
  }

  async function handleSave() {
    const input = buildInput();
    const result = validateTrusteeUpcomingKeyDates(input);
    if (!result.valid) {
      setError(resolveKeyDatesSaveError(result.reasonMap, OWNED_FIELDS));
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      await Api2.putUpcomingKeyDates(trusteeId!, appointmentId!, input);
      navigate(`/trustees/${trusteeId}/appointments`);
    } catch (err) {
      globalAlert?.error(`Failed to save annual report key dates: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    navigate(`/trustees/${trusteeId}/appointments`);
  }

  if (isLoading) {
    return <LoadingSpinner id="edit-annual-report-key-dates-loading" />;
  }

  if (!canManage) {
    return (
      <Stop
        id="forbidden-alert"
        title="Forbidden"
        message="You do not have permission to manage Trustee Annual Report Key Dates"
        asError
      />
    );
  }

  return (
    <div className="edit-upcoming-key-dates" data-testid="edit-annual-report-key-dates">
      <h3>Edit Annual Report</h3>
      <p>
        Annual Report Submission and Annual Report Due to OO are fixed for Chapter 12 and 13 Case by
        Case appointments and cannot be edited.
      </p>
      {error && (
        <Alert id="annual-report-completion-error" type={UswdsAlertStyle.Error} inline show slim>
          {error}
        </Alert>
      )}
      <CompletionStatusFields
        idPrefix="annual-report-completion"
        legend="Annual Report Completion"
        value={completion}
        onChange={setCompletion}
      />
      <div className="usa-button-group">
        <Button
          id="save-annual-report-key-dates"
          data-testid="button-save-annual-report-key-dates"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          id="cancel-annual-report-key-dates"
          data-testid="button-cancel-annual-report-key-dates"
          uswdsStyle={UswdsButtonStyle.Unstyled}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
