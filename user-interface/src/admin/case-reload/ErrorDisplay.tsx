import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';

interface ErrorDisplayProps {
  validationError: string | null;
  reloadError: string | null;
}

export function ErrorDisplay({ validationError, reloadError }: ErrorDisplayProps) {
  return (
    <>
      {validationError && (
        <div className="grid-row" data-testid="validation-error-container">
          <div className="grid-col-12">
            <Alert
              type={UswdsAlertStyle.Error}
              title={validationError === 'Case Not Found' ? validationError : 'Error'}
              message={validationError === 'Case Not Found' ? undefined : validationError}
              show={true}
              inline={true}
              id="validation-error-alert"
            />
          </div>
        </div>
      )}

      {reloadError && (
        <div className="grid-row" data-testid="reload-error-container">
          <div className="grid-col-12">
            <Alert
              type={UswdsAlertStyle.Error}
              title="Reload Error"
              message={reloadError}
              show={true}
              inline={true}
              id="reload-error-alert"
            />
          </div>
        </div>
      )}
    </>
  );
}
