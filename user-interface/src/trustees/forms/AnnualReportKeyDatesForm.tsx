import './EditUpcomingKeyDates.scss';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { Stop } from '@/lib/components/Stop';
import { mergeKeyDatesInput } from './chapter7PanelKeyDatesInput';
import CompletionStatusFields, { CompletionStatusValue } from './CompletionStatusFields';
import { validateCompletionPairPresence } from '@common/cams/trustee-upcoming-key-dates';

const EMPTY_COMPLETION: CompletionStatusValue = { year: '', status: '' };

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
    // No whole-document validation here. The field this form owns is checked
    // inline, and the API validates the rest; the four Chapter 7 Panel forms
    // work the same way. Validating the merged document client-side blocked
    // saves on fields this form cannot display, with no way to fix them.
    setIsSaving(true);
    try {
      await Api2.putUpcomingKeyDates(trusteeId!, appointmentId!, buildInput());
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

  const completionPairError = validateCompletionPairPresence(
    completion.year,
    completion.status,
    'Annual Report Completion Status',
  );

  return (
    <div className="edit-upcoming-key-dates" data-testid="edit-annual-report-key-dates">
      <h3>Edit Annual Report</h3>
      <p>
        Annual Report Submission and Annual Report Due to OO are fixed for Chapter 12 and 13 Case by
        Case appointments and cannot be edited.
      </p>
      <CompletionStatusFields
        idPrefix="annual-report-completion"
        legend="Annual Report Completion"
        value={completion}
        onChange={setCompletion}
        errorLabel="Annual Report Completion Status"
      />
      <div className="usa-button-group">
        <Button
          id="save-annual-report-key-dates"
          data-testid="button-save-annual-report-key-dates"
          onClick={handleSave}
          disabled={isSaving || !!completionPairError}
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
