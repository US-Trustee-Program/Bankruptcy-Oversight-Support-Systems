import { useCallback, useEffect, useRef, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { CamsHttpError } from '@/lib/models/api';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { formatDateTime } from '@/lib/utils/datetime';
import HttpStatusCodes from '@common/api/http-status-codes';
import {
  TRUSTEE_APPOINTMENT_FIELDS,
  TrusteeAppointmentField,
  TrusteeDataReportRun,
  TrusteeDataReportStatus,
  TrusteeDataReportSummary,
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

const APPOINTMENT_FIELD_LABELS: Record<TrusteeAppointmentField, string> = {
  status: 'Status',
  appointedDate: 'Appointed date',
  effectiveDate: 'Status effective date',
};

// A stored run can predate a count added later, so a missing count must not break the tab, which
// would also hide the button that starts the run that replaces it.
const count = (value: number | undefined) =>
  value === undefined ? 'Not recorded' : value.toLocaleString('en-US');

const TOD_ONLY_LABEL = 'In TOD only';
const FIELD_DIFFERENCES_LABEL = 'Field differences';
const APPOINTMENT_FIELD_DIFFERENCES_LABEL = 'Appointment field differences';

type CountRow = { key: string; label: string; value: number | undefined; parent?: string };

/** The summary's counts in table order. A row with a parent breaks that count down. */
function countRows(summary: Partial<TrusteeDataReportSummary>): CountRow[] {
  return [
    { key: 'trustees-compared', label: 'Trustees compared', value: summary.trusteesCompared },
    { key: 'tod-only', label: TOD_ONLY_LABEL, value: summary.todOnly },
    {
      key: 'tod-only-status-missing',
      label: 'Status missing, needs review',
      value: summary.todOnlyStatusMissing,
      parent: TOD_ONLY_LABEL,
    },
    { key: 'cams-only', label: 'In CAMS only', value: summary.camsOnly },
    { key: 'field-differences', label: FIELD_DIFFERENCES_LABEL, value: summary.fieldDifferences },
    ...(Object.keys(FIELD_LABELS) as TrusteeProfileField[]).map((field) => ({
      key: `field-${field}`,
      label: FIELD_LABELS[field],
      value: summary.fieldDifferencesByField?.[field],
      parent: FIELD_DIFFERENCES_LABEL,
    })),
    {
      key: 'appointments-tod-only',
      label: 'Appointments in TOD only',
      value: summary.appointmentsTodOnly,
    },
    {
      key: 'appointments-cams-only',
      label: 'Appointments in CAMS only',
      value: summary.appointmentsCamsOnly,
    },
    {
      key: 'appointment-field-differences',
      label: APPOINTMENT_FIELD_DIFFERENCES_LABEL,
      value: summary.appointmentFieldDifferences,
    },
    ...TRUSTEE_APPOINTMENT_FIELDS.map((field) => ({
      key: `appointment-field-${field}`,
      label: APPOINTMENT_FIELD_LABELS[field],
      value: summary.appointmentFieldDifferencesByField?.[field],
      parent: APPOINTMENT_FIELD_DIFFERENCES_LABEL,
    })),
    {
      key: 'appointments-divisions-narrowed',
      label: 'Divisions narrowed in CAMS',
      value: summary.appointmentsDivisionsNarrowed,
    },
    {
      key: 'tod-appointments-not-translated',
      label: 'TOD appointments not translated',
      value: summary.todAppointmentsNotTranslated,
    },
  ];
}

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
            {countRows(summary).map(({ key, label, value, parent }) => (
              <tr key={key}>
                <th scope="row" className={parent ? 'padding-left-4' : undefined}>
                  {parent && <span className="usa-sr-only">{parent}:</span>}
                  {parent && ' '}
                  {label}
                </th>
                <td data-testid={`trustee-data-report-count-${key}`}>{count(value)}</td>
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
  const [startError, setStartError] = useState<{
    title: string;
    message?: string;
    alreadyRunning?: boolean;
  } | null>(null);
  // Counts finished status checks, so every check (even one failing exactly like the last)
  // schedules the next one while a run is active.
  const [checks, setChecks] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const response = await Api2.getTrusteeDataReport();
      setStatus(response.data);
      setLoadError(null);
      if (!response.data.activeRun) {
        // The run that blocked a start has ended, so "already running" no longer applies.
        setStartError((current) => (current?.alreadyRunning ? null : current));
      }
    } catch (error) {
      setLoadError((error as Error)?.message ?? 'Reason unknown.');
    } finally {
      setIsLoading(false);
      setChecks((count) => count + 1);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll while a run is queued or running; each finished check schedules the next one. A failed
  // check keeps polling, so the next good response clears the error.
  useEffect(() => {
    if (!status?.activeRun) return;
    const timer = setTimeout(refresh, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [status, checks, refresh]);

  // The status region is the tab's single announcer. It speaks transitions only: what was already
  // true when the tab opened is on screen and is not announced. A completed or failed report is
  // announced only when a run was active before, so a start that fails (its alert speaks for it)
  // never reads as "Report completed."
  const statusMessage = liveStatusMessage(status, isStarting);
  const hasActiveRun = !!status?.activeRun;
  const lastStatusMessageRef = useRef<string | null>(null);
  const hadActiveRunRef = useRef(false);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (isLoading) return;
    const isRunOutcome = !hasActiveRun && !isStarting;
    if (
      lastStatusMessageRef.current !== null &&
      statusMessage !== lastStatusMessageRef.current &&
      (!isRunOutcome || hadActiveRunRef.current)
    ) {
      setAnnouncement(statusMessage);
    }
    lastStatusMessageRef.current = statusMessage;
    hadActiveRunRef.current = hasActiveRun;
  }, [statusMessage, isLoading, hasActiveRun, isStarting]);

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
        setStartError({ title: 'A report is already running', alreadyRunning: true });
      } else {
        setStartError({
          title: 'The report could not be started',
          message: (error as Error)?.message,
        });
      }
      // Show the run that is blocking the start, or the run this start recorded as failed.
      await refresh();
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
        Compares trustee profiles and appointments in CAMS with TOD. It counts trustees and
        appointments found in only one system, and profile and appointment fields that differ. A
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
            aria-describedby={activeRun ? 'trustee-data-report-active-text' : undefined}
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
            <div
              data-testid="trustee-data-report-active"
              className="display-flex flex-align-center"
            >
              {/* The spinner is its own live region, so it is hidden; the status region announces
                  changes, and the text below stays readable. */}
              <LoadingSpinner aria-hidden="true" />
              <p id="trustee-data-report-active-text" data-testid="trustee-data-report-active-text">
                Report {activeRun.status}, started by {activeRun.startedBy.name}. This page updates
                when it finishes.
              </p>
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
                {(latestFailedRun.failureMessage ?? 'reason unknown').replace(/\.$/, '')}.
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
