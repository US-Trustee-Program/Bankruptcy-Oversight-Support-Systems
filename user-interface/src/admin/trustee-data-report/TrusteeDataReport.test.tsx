import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Api2 from '@/lib/models/api2';
import { CamsHttpError } from '@/lib/models/api';
import { formatDateTime } from '@/lib/utils/datetime';
import {
  TrusteeDataReportRun,
  TrusteeDataReportStatus,
  TrusteeDataReportSummary,
} from '@common/cams/trustee-data-report';
import { POLL_INTERVAL_MS, TrusteeDataReport } from './TrusteeDataReport';

const SUMMARY: TrusteeDataReportSummary = {
  trusteesCompared: 1200,
  todOnly: 4,
  camsOnly: 2,
  fieldDifferences: 9,
  fieldDifferencesByField: {
    name: 1,
    companyName: 0,
    publicAddress: 3,
    internalAddress: 0,
    phone: 4,
    email: 1,
  },
};

function run(override: Partial<TrusteeDataReportRun>): TrusteeDataReportRun {
  return {
    runId: 'run-1',
    status: 'completed',
    startedBy: { id: 'user-1', name: 'Test SuperUser' },
    queuedAt: '2026-11-17T10:00:00.000Z',
    ...override,
  };
}

const COMPLETED = run({
  runId: 'run-done',
  finishedAt: '2026-11-17T10:05:00.000Z',
  summary: SUMMARY,
});
const RUNNING = run({ runId: 'run-active', status: 'running' });

function mockGet(...responses: TrusteeDataReportStatus[]) {
  const spy = vi.spyOn(Api2, 'getTrusteeDataReport');
  responses.forEach((data) => spy.mockResolvedValueOnce({ data }));
  return spy.mockResolvedValue({ data: responses[responses.length - 1] });
}

const startButton = () => screen.getByTestId('button-trustee-data-report-start');
const liveStatus = () => screen.getByTestId('trustee-data-report-live-status');

/** Start stays focusable while blocked (aria-disabled), so keyboard users keep their place. */
function expectStartBlocked(blocked: boolean) {
  expect(startButton()).toBeEnabled();
  expect(startButton().getAttribute('aria-disabled')).toBe(String(blocked));
}

async function renderLoaded() {
  render(<TrusteeDataReport />);
  await waitFor(() => expect(screen.queryByTestId('trustee-data-report-loading')).toBeNull());
}

describe('TrusteeDataReport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should show an empty state and allow a start before any report has run', async () => {
    mockGet({});

    await renderLoaded();

    expect(screen.getByTestId('trustee-data-report-empty')).toBeInTheDocument();
    expectStartBlocked(false);
  });

  test('should show the latest completed run with its finish time and counts', async () => {
    mockGet({ latestCompletedRun: COMPLETED });

    await renderLoaded();

    expect(screen.getByTestId('trustee-data-report-finished-at')).toHaveTextContent(
      formatDateTime(COMPLETED.finishedAt),
    );
    const counts = {
      'trustees-compared': '1,200',
      'tod-only': '4',
      'cams-only': '2',
      'field-differences': '9',
      'field-publicAddress': '3',
      'field-phone': '4',
    };
    Object.entries(counts).forEach(([key, value]) =>
      expect(screen.getByTestId(`trustee-data-report-count-${key}`)).toHaveTextContent(value),
    );
    expect(screen.queryByTestId('trustee-data-report-difference-list')).toBeNull();
    // Per-field rows say which count they break down, not just "Phone".
    expect(
      screen.getByTestId('trustee-data-report-count-field-phone').closest('tr'),
    ).toHaveTextContent('Field differences: Phone');
  });

  test('should block start while a run is in progress, without announcing what was already true on load', async () => {
    mockGet({ activeRun: RUNNING, latestCompletedRun: COMPLETED });
    const post = vi.spyOn(Api2, 'postTrusteeDataReport');

    await renderLoaded();

    expectStartBlocked(true);
    await userEvent.click(startButton());
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByTestId('trustee-data-report-active')).toHaveAttribute('aria-hidden', 'true');
    expect(liveStatus()).toHaveTextContent('');
    expect(screen.getByTestId('trustee-data-report-finished-at')).toBeInTheDocument();
  });

  test('should poll while a run is in progress and stop once it ends', async () => {
    const get = mockGet({ activeRun: RUNNING }, { latestCompletedRun: COMPLETED });

    await renderLoaded();
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    await waitFor(() => expectStartBlocked(false));
    expect(screen.getByTestId('trustee-data-report-finished-at')).toBeInTheDocument();
    expect(liveStatus()).toHaveTextContent('completed');

    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3));
    expect(get).toHaveBeenCalledTimes(2);
  });

  test('should start a run, then show it as queued and poll for it', async () => {
    const get = mockGet({ latestCompletedRun: COMPLETED });
    const queued = run({ runId: 'run-new', status: 'queued' });
    const post = vi.spyOn(Api2, 'postTrusteeDataReport').mockResolvedValue({ data: queued });

    await renderLoaded();
    await userEvent.click(startButton());

    expect(post).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(liveStatus()).toHaveTextContent('queued'));
    expectStartBlocked(true);

    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    expect(get).toHaveBeenCalledTimes(2);
  });

  test('should say a report is already running when the start is refused with 409', async () => {
    mockGet(
      { latestCompletedRun: COMPLETED },
      { activeRun: RUNNING, latestCompletedRun: COMPLETED },
    );
    vi.spyOn(Api2, 'postTrusteeDataReport').mockRejectedValue(
      new CamsHttpError(409, 'A trustee data report is already running.'),
    );

    await renderLoaded();
    await userEvent.click(startButton());

    await waitFor(() =>
      expect(screen.getByTestId('alert-trustee-data-report-start-error')).toHaveTextContent(
        'A report is already running',
      ),
    );
    await waitFor(() => expectStartBlocked(true));
  });

  test('should report any other start failure', async () => {
    mockGet({});
    vi.spyOn(Api2, 'postTrusteeDataReport').mockRejectedValue(new Error('Network down'));

    await renderLoaded();
    await userEvent.click(startButton());

    await waitFor(() =>
      expect(screen.getByTestId('alert-trustee-data-report-start-error')).toHaveTextContent(
        'The report could not be started',
      ),
    );
    expectStartBlocked(false);
  });

  test('should show a failed latest run next to the last completed results', async () => {
    const failed = run({
      runId: 'run-failed',
      status: 'failed',
      finishedAt: '2026-11-17T12:00:00.000Z',
      failureMessage: 'TOD query timed out',
    });
    mockGet({ latestCompletedRun: COMPLETED, latestFailedRun: failed });

    await renderLoaded();

    const failure = screen.getByTestId('alert-trustee-data-report-failed');
    expect(failure).toHaveTextContent('TOD query timed out');
    expect(failure).toHaveTextContent(formatDateTime(failed.finishedAt));
    expect(screen.getByTestId('trustee-data-report-finished-at')).toBeInTheDocument();
    expectStartBlocked(false);
  });

  test('should keep checking after a failed status check during a run, and recover', async () => {
    const get = vi
      .spyOn(Api2, 'getTrusteeDataReport')
      .mockResolvedValueOnce({ data: { activeRun: RUNNING } })
      .mockRejectedValueOnce(new Error('Network blip'))
      .mockResolvedValue({ data: { latestCompletedRun: COMPLETED } });

    await renderLoaded();
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    expect(await screen.findByTestId('alert-trustee-data-report-load-error')).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    await waitFor(() =>
      expect(screen.queryByTestId('alert-trustee-data-report-load-error')).toBeNull(),
    );
    expect(get).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId('trustee-data-report-finished-at')).toBeInTheDocument();
  });

  test('should show an error when the status cannot be loaded', async () => {
    vi.spyOn(Api2, 'getTrusteeDataReport').mockRejectedValue(new Error('Network down'));

    await renderLoaded();

    expect(screen.getByTestId('alert-trustee-data-report-load-error')).toBeInTheDocument();
  });
});
