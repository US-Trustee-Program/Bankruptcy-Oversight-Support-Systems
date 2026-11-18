import { vi } from 'vitest';
import factory from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { ApiToDataflowsGatewayImpl } from '../../adapters/gateways/api-to-dataflows/api-to-dataflows.gateway';
import HttpStatusCodes from '@common/api/http-status-codes';
import TrusteeDataReportLock from './trustee-data-report-lock';
import RunTrusteeDataReport from './run-trustee-data-report';
import { startTrusteeDataReport } from './start-trustee-data-report';

describe('startTrusteeDataReport', () => {
  let context: ApplicationContext;
  let reportRepo: MockMongoRepository;
  let gateway: ApiToDataflowsGatewayImpl;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    reportRepo = new MockMongoRepository();
    gateway = new ApiToDataflowsGatewayImpl();
    vi.spyOn(factory, 'getTrusteeDataReportRepository').mockReturnValue(reportRepo);
    vi.spyOn(factory, 'getApiToDataflowsGateway').mockReturnValue(gateway);
    vi.spyOn(reportRepo, 'upsertRun').mockResolvedValue();
    vi.spyOn(gateway, 'queueTrusteeDataReportStart').mockResolvedValue();
    vi.spyOn(RunTrusteeDataReport, 'failRun').mockResolvedValue();
  });

  test('should claim the lock, write a queued run and enqueue its start', async () => {
    const claim = vi.spyOn(TrusteeDataReportLock, 'claimRun').mockResolvedValue({ claimed: true });

    const run = await startTrusteeDataReport(context);

    expect(run).toEqual({
      runId: expect.any(String),
      status: 'queued',
      startedBy: { id: context.session.user.id, name: context.session.user.name },
      queuedAt: expect.any(String),
    });
    expect(claim).toHaveBeenCalledWith(context, run.runId);
    expect(reportRepo.upsertRun).toHaveBeenCalledWith(run);
    expect(gateway.queueTrusteeDataReportStart).toHaveBeenCalledWith({ runId: run.runId });
    expect(RunTrusteeDataReport.failRun).not.toHaveBeenCalled();
  });

  test('should mint a new runId for every start', async () => {
    vi.spyOn(TrusteeDataReportLock, 'claimRun').mockResolvedValue({ claimed: true });

    const first = await startTrusteeDataReport(context);
    const second = await startTrusteeDataReport(context);

    expect(first.runId).not.toBe(second.runId);
  });

  test('should refuse with 409 while another run is active, writing and queueing nothing', async () => {
    vi.spyOn(TrusteeDataReportLock, 'claimRun').mockResolvedValue({
      claimed: false,
      activeRunId: 'run-active',
    });

    await expect(startTrusteeDataReport(context)).rejects.toEqual(
      expect.objectContaining({ status: HttpStatusCodes.CONFLICT }),
    );
    expect(reportRepo.upsertRun).not.toHaveBeenCalled();
    expect(gateway.queueTrusteeDataReportStart).not.toHaveBeenCalled();
  });

  test('should mark a stale run it replaced as failed, then still start the new run', async () => {
    vi.spyOn(TrusteeDataReportLock, 'claimRun').mockResolvedValue({
      claimed: true,
      replacedStaleRunId: 'run-crashed',
    });

    const run = await startTrusteeDataReport(context);

    expect(RunTrusteeDataReport.failRun).toHaveBeenCalledWith(
      context,
      'run-crashed',
      expect.any(String),
    );
    expect(reportRepo.upsertRun).toHaveBeenCalledWith(run);
    expect(gateway.queueTrusteeDataReportStart).toHaveBeenCalledWith({ runId: run.runId });
  });

  test.each([
    { step: 'saving the queued run', fail: 'upsertRun' as const },
    { step: 'failing the stale run it replaced', fail: 'failStale' as const },
  ])('should release the lock and pass on the error when $step fails', async ({ fail }) => {
    vi.spyOn(TrusteeDataReportLock, 'claimRun').mockResolvedValue({
      claimed: true,
      replacedStaleRunId: 'run-crashed',
    });
    if (fail === 'upsertRun') {
      vi.spyOn(reportRepo, 'upsertRun').mockRejectedValue(new Error('cosmos down'));
    } else {
      vi.mocked(RunTrusteeDataReport.failRun).mockRejectedValueOnce(new Error('cosmos down'));
    }

    await expect(startTrusteeDataReport(context)).rejects.toThrow('cosmos down');
    const newRunId = vi.mocked(TrusteeDataReportLock.claimRun).mock.calls[0][1];
    expect(RunTrusteeDataReport.failRun).toHaveBeenLastCalledWith(
      context,
      newRunId,
      expect.any(String),
    );
    expect(gateway.queueTrusteeDataReportStart).not.toHaveBeenCalled();
  });

  test('should fail the new run and pass on the queue error when its start cannot be queued', async () => {
    vi.spyOn(TrusteeDataReportLock, 'claimRun').mockResolvedValue({ claimed: true });
    vi.spyOn(gateway, 'queueTrusteeDataReportStart').mockRejectedValue(new Error('queue down'));

    await expect(startTrusteeDataReport(context)).rejects.toThrow('queue down');
    const runId = vi.mocked(reportRepo.upsertRun).mock.calls[0][0].runId;
    expect(RunTrusteeDataReport.failRun).toHaveBeenCalledWith(context, runId, expect.any(String));
  });
});
