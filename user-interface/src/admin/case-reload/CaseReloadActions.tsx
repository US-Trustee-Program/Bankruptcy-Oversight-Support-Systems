import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { PollStatus } from './case-reload-types';

interface CaseReloadActionsProps {
  pollStatus: PollStatus;
  isReloadable: boolean;
  isReloading: boolean;
  onReload: () => void;
  onReset: () => void;
}

export function CaseReloadActions({
  pollStatus,
  isReloadable,
  isReloading,
  onReload,
  onReset,
}: CaseReloadActionsProps) {
  return (
    <div className="grid-row">
      <div className="grid-col-12 button-group">
        {pollStatus !== 'success' && (
          <Button
            id="reload-button"
            onClick={onReload}
            uswdsStyle={UswdsButtonStyle.Default}
            disabled={!isReloadable || pollStatus === 'polling' || isReloading}
          >
            Reload Case
          </Button>
        )}
        <Button id="reset-button" onClick={onReset} uswdsStyle={UswdsButtonStyle.Outline}>
          Reset
        </Button>
      </div>
    </div>
  );
}
