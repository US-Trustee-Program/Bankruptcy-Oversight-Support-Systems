import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';

type PollStatus = 'idle' | 'polling' | 'success' | 'timeout';

interface PollingStatusDisplayProps {
  pollStatus: PollStatus;
  isReloading: boolean;
}

export function PollingStatusDisplay({ pollStatus, isReloading }: PollingStatusDisplayProps) {
  return (
    <>
      {pollStatus === 'success' && (
        <div className="grid-row" data-testid="polling-success-container">
          <div className="grid-col-12">
            <Alert
              type={UswdsAlertStyle.Success}
              title="Sync Completed"
              message="Sync completed successfully"
              show={true}
              inline={true}
              id="polling-success-alert"
            />
          </div>
        </div>
      )}

      {isReloading && (
        <div className="grid-row">
          <div className="grid-col-12">
            <LoadingSpinner caption="Queueing reload..." />
          </div>
        </div>
      )}

      {pollStatus === 'polling' && (
        <div className="grid-row" data-testid="polling-status-container">
          <div className="grid-col-12">
            <LoadingSpinner caption="Waiting for the reload to complete..." />
          </div>
        </div>
      )}

      {pollStatus === 'timeout' && (
        <div className="grid-row" data-testid="polling-timeout-container">
          <div className="grid-col-12">
            <Alert
              type={UswdsAlertStyle.Warning}
              title="Case reload is taking longer than expected"
              message="The sync may still complete in the background"
              show={true}
              inline={true}
              id="polling-timeout-alert"
            />
          </div>
        </div>
      )}
    </>
  );
}
