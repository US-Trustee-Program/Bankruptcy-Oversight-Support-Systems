import { vi } from 'vitest';
import factory from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { TrusteeDataReportRun } from '@common/cams/trustee-data-report';
import TrusteeDataReportLock from './trustee-data-report-lock';
import { getLatestTrusteeDataReport } from './get-latest-trustee-data-report';

function run(runId: string, status: TrusteeDataReportRun['status']): TrusteeDataReportRun {
  return {
    runId,
    status,
    startedBy: { id: 'user-1', name: 'Test SuperUser' },
    queuedAt: '2026-11-17T10:00:00.000Z',
  };
}

describe('getLatestTrusteeDataReport', () => {
  let context: ApplicationContext;
  let reportRepo: MockMongoRepository;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    reportRepo = new MockMongoRepository();
    vi.spyOn(factory, 'getTrusteeDataReportRepository').mockReturnValue(reportRepo);
    // Explicit defaults, so no test depends on the in-memory mock's shared (static) run data.
    vi.spyOn(TrusteeDataReportLock, 'activeRunId').mockResolvedValue(null);
    vi.spyOn(reportRepo, 'readRun').mockResolvedValue(null);
    vi.spyOn(reportRepo, 'readLatestCompletedRun').mockResolvedValue(null);
    vi.spyOn(reportRepo, 'readLatestFailedRun').mockResolvedValue(null);
  });

  test('should return nothing before any report has run', async () => {
    vi.spyOn(TrusteeDataReportLock, 'activeRunId').mockResolvedValue(null);
    vi.spyOn(reportRepo, 'readLatestCompletedRun').mockResolvedValue(null);

    expect(await getLatestTrusteeDataReport(context)).toEqual({});
  });

  test('should return the active run and the latest completed run', async () => {
    const active = run('run-active', 'running');
    const completed = run('run-done', 'completed');
    vi.spyOn(TrusteeDataReportLock, 'activeRunId').mockResolvedValue('run-active');
    vi.spyOn(reportRepo, 'readRun').mockResolvedValue(active);
    vi.spyOn(reportRepo, 'readLatestCompletedRun').mockResolvedValue(completed);

    expect(await getLatestTrusteeDataReport(context)).toEqual({
      activeRun: active,
      latestCompletedRun: completed,
    });
    expect(reportRepo.readRun).toHaveBeenCalledWith('run-active');
  });

  test('should return a failed run that finished after the latest completed run', async () => {
    const completed = { ...run('run-done', 'completed'), finishedAt: '2026-11-16T10:00:00.000Z' };
    const failed = { ...run('run-failed', 'failed'), finishedAt: '2026-11-17T10:00:00.000Z' };
    vi.spyOn(TrusteeDataReportLock, 'activeRunId').mockResolvedValue(null);
    vi.spyOn(reportRepo, 'readLatestCompletedRun').mockResolvedValue(completed);
    vi.spyOn(reportRepo, 'readLatestFailedRun').mockResolvedValue(failed);

    expect(await getLatestTrusteeDataReport(context)).toEqual({
      latestCompletedRun: completed,
      latestFailedRun: failed,
    });
  });

  test('should omit a failed run that a later completed run replaced', async () => {
    const failed = { ...run('run-failed', 'failed'), finishedAt: '2026-11-16T10:00:00.000Z' };
    const completed = { ...run('run-done', 'completed'), finishedAt: '2026-11-17T10:00:00.000Z' };
    vi.spyOn(TrusteeDataReportLock, 'activeRunId').mockResolvedValue(null);
    vi.spyOn(reportRepo, 'readLatestCompletedRun').mockResolvedValue(completed);
    vi.spyOn(reportRepo, 'readLatestFailedRun').mockResolvedValue(failed);

    expect(await getLatestTrusteeDataReport(context)).toEqual({ latestCompletedRun: completed });
  });

  test('should return a failed run when no run has ever completed', async () => {
    const failed = { ...run('run-failed', 'failed'), finishedAt: '2026-11-17T10:00:00.000Z' };
    vi.spyOn(TrusteeDataReportLock, 'activeRunId').mockResolvedValue(null);
    vi.spyOn(reportRepo, 'readLatestCompletedRun').mockResolvedValue(null);
    vi.spyOn(reportRepo, 'readLatestFailedRun').mockResolvedValue(failed);

    expect(await getLatestTrusteeDataReport(context)).toEqual({ latestFailedRun: failed });
  });

  test('should omit the active run when the lock names a run that no longer exists', async () => {
    vi.spyOn(TrusteeDataReportLock, 'activeRunId').mockResolvedValue('run-gone');
    vi.spyOn(reportRepo, 'readRun').mockResolvedValue(null);
    vi.spyOn(reportRepo, 'readLatestCompletedRun').mockResolvedValue(null);

    expect(await getLatestTrusteeDataReport(context)).toEqual({});
  });
});
