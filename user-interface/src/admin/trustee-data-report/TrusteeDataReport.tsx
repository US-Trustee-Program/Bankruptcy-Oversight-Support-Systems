import { useCallback, useEffect, useRef, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { CamsHttpError } from '@/lib/models/api';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { formatDateTime } from '@/lib/utils/datetime';
import HttpStatusCodes from '@common/api/http-status-codes';
import {
  TrusteeDataReportRun,
  TrusteeDataReportStatus,
  TrusteeProfileField,
} from '@common/cams/trustee-data-report';

/** How often the tab checks on a run in progress. */
export const POLL_INTERVAL_MS = 5000;

const FIELD_LABELS: Record<TrusteeProfileField, string> = {
  name: 'Name',
  companyName: 'Company name',
  publicAddress: 'Public address',
  internalAddress: 'Internal address',
  phone: 'Phone',
  email: 'Email',
};

const count = (value: number) => value.toLocaleString('en-US');

function liveStatusMessage(status: TrusteeDataReportStatus | null, isStarting: boolean): string {
  if (isStarting) return 'Starting the report.';
  if (status?.activeRun) return `Report ${status.activeRun.status}.`;
  if (status?.latestFailedRun) return 'The latest report failed.';
  if (status?.latestCompletedRun) return 'Report completed.';
  return '';
}

function CompletedRunSummary({ run }: Readonly<{ run: TrusteeDataReportRun }>) {
  const summary = run.summary;
  return (
    <section
      data-testid="trustee-data-report-results"
      aria-labelledby="trustee-data-report-results-heading"
    >
      <h3 id="trustee-data-report-results-heading">Latest results</h3>
      <p>
        Completed{' '}
        <span data-testid="trustee-data-report-finished-at">{formatDateTime(run.finishedAt)}</span>
      </p>
      {summary && (
        <table className="usa-table usa-table--borderless">
          <caption className="usa-sr-only">Trustee data report counts</caption>
          <tbody>
            {[
              ['trustees-compared', 'Trustees compared', summary.trusteesCompared],
              ['tod-only', 'In TOD only', summary.todOnly],
              ['cams-only', 'In CAMS only', summary.camsOnly],
              ['field-differences', 'Field differences', summary.fieldDifferences],
            ].map(([key, label, value]) => (
              <tr key={key}>
                <th scope="row">{label}</th>
                <td data-testid={`trustee-data-report-count-${key}`}>{count(value as number)}</td>
              </tr>
            ))}
            {(Object.keys(FIELD_LABELS) as TrusteeProfileField[]).map((field) => (
              <tr key={field}>
                <th scope="row" className="padding-left-4">
                  <span className="usa-sr-only">Field differences: </span>
                  {FIELD_LABELS[field]}
                </th>
                <td data-testid={`trustee-data-report-count-field-${field}`}>
                  {count(summary.fieldDifferencesByField[field])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function TrusteeDataReport() {
  const [status, setStatus] = useState<TrusteeDataReportStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [startError, setStartError] = useState<{ title: string; message?: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await Api2.getTrusteeDataReport();
      setStatus(response.data);
      setLoadError(null);
    } catch (error) {
      setLoadError((error as Error)?.message ?? 'Reason unknown.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll while a run is queued or running; each refresh schedules the next one. A failed check
  // keeps polling, so the next good response clears the error.
  useEffect(() => {
    if (!status?.activeRun) return;
    const timer = setTimeout(refresh, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [status, loadError, refresh]);

  // The status region is the tab's single announcer. It speaks transitions only: what was already
  // true when the tab opened is on screen and is not announced.
  const statusMessage = liveStatusMessage(status, isStarting);
  const lastStatusMessage = useRef<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (isLoading) return;
    if (lastStatusMessage.current !== null && statusMessage !== lastStatusMessage.current) {
      setAnnouncement(statusMessage);
    }
    lastStatusMessage.current = statusMessage;
  }, [statusMessage, isLoading]);

  const activeRun = status?.activeRun;
  const isStartBlocked = isStarting || !!activeRun;

  async function handleStart() {
    if (isStartBlocked) return;
    setIsStarting(true);
    setStartError(null);
    try {
      const response = await Api2.postTrusteeDataReport();
      const run = response?.data;
      if (run) {
        setStatus((current) => ({ ...current, activeRun: run }));
      } else {
        await refresh();
      }
    } catch (error) {
      if (error instanceof CamsHttpError && error.status === HttpStatusCodes.CONFLICT) {
        setStartError({ title: 'A report is already running' });
        await refresh();
      } else {
        setStartError({
          title: 'The report could not be started',
          message: (error as Error)?.message,
        });
      }
    } finally {
      setIsStarting(false);
    }
  }

  const latestCompletedRun = status?.latestCompletedRun;
  const latestFailedRun = status?.latestFailedRun;

  return (
    <div className="trustee-data-report-admin-panel" data-testid="trustee-data-report-panel">
      <h2>Trustee Data Report</h2>
      <p>
        Compares trustee profiles in CAMS with TOD and counts the trustees and fields that differ. A
        report takes a few minutes.
      </p>

      <p className="usa-sr-only" role="status" data-testid="trustee-data-report-live-status">
        {announcement}
      </p>

      {isLoading && <LoadingSpinner id="trustee-data-report-loading" caption="Loading..." />}

      {!isLoading && (
        <>
          <Button
            id="trustee-data-report-start"
            uswdsStyle={UswdsButtonStyle.Default}
            onClick={handleStart}
            aria-disabled={isStartBlocked}
          >
            Start report
          </Button>

          {startError && (
            <Alert
              id="trustee-data-report-start-error"
              type={UswdsAlertStyle.Error}
              title={startError.title}
              message={startError.message}
              show={true}
              inline={true}
            />
          )}

          {loadError && (
            <Alert
              id="trustee-data-report-load-error"
              type={UswdsAlertStyle.Error}
              title="The report status could not be loaded"
              message={loadError}
              show={true}
              inline={true}
            />
          )}

          {activeRun && (
            // aria-hidden: the spinner is its own live region; the status region announces instead.
            <div data-testid="trustee-data-report-active" aria-hidden="true">
              <LoadingSpinner
                caption={`Report ${activeRun.status}, started by ${activeRun.startedBy.name}. This page updates when it finishes.`}
              />
            </div>
          )}

          {latestFailedRun && (
            <Alert
              id="trustee-data-report-failed"
              type={UswdsAlertStyle.Warning}
              title="The latest report failed"
              show={true}
              inline={true}
            >
              <p className="usa-alert__text">
                The report that ended {formatDateTime(latestFailedRun.finishedAt)} failed:{' '}
                {latestFailedRun.failureMessage ?? 'reason unknown'}.
                {latestCompletedRun &&
                  ' The results below are from the last report that completed.'}
              </p>
            </Alert>
          )}

          {latestCompletedRun ? (
            <CompletedRunSummary run={latestCompletedRun} />
          ) : (
            !activeRun &&
            !latestFailedRun &&
            !loadError && (
              <p data-testid="trustee-data-report-empty">
                No report has been run yet. Start a report to compare CAMS with TOD.
              </p>
            )
          )}
        </>
      )}
    </div>
  );
}
