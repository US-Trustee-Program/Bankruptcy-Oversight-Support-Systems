import { vi, describe, test, expect, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import SyncCases from '../../../lib/use-cases/dataflows/sync-cases';
import ExportAndLoadCase from '../../../lib/use-cases/dataflows/export-and-load-case';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { UnknownError } from '../../../lib/common-errors/unknown-error';
import { NotFoundError } from '../../../lib/common-errors/not-found-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { handleStart, handlePage, handleError, handleRetry } from './resync-cases-by-date';

describe('resync-cases-by-date', () => {
  let invocationContext: InvocationContext;
  const extraOutputsMap = new Map();
  let sendMessageSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    delete process.env.AzureWebJobsDataflowsStorage;

    sendMessageSpy = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: sendMessageSpy,
    } as unknown as StorageQueueHumbleObject);

    vi.spyOn(DataflowTelemetry, 'completeDataflowTrace').mockResolvedValue(undefined);

    process.env.AzureWebJobsDataflowsStorage =
      'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=dGVzdA==;EndpointSuffix=core.windows.net';
    await createMockApplicationContext();
    extraOutputsMap.clear();
    invocationContext = {
      invocationId: 'test-invocation-id',
      functionName: 'resync-cases-by-date-handlePage',
      extraOutputs: {
        set: vi.fn((key, value) => extraOutputsMap.set(key, value)),
        get: vi.fn((key) => extraOutputsMap.get(key)),
      },
      log: vi.fn(),
    } as unknown as InvocationContext;

    vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockResolvedValue([]);
  });

  describe('handleStart', () => {
    test('should log error and return early when fromDate is missing', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

      await handleStart({ fromDate: '' }, invocationContext);

      expect(invocationContext.extraOutputs.set).not.toHaveBeenCalled();
      expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.any(String),
        'handleStart',
        expect.anything(),
        expect.objectContaining({ success: false }),
      );
    });

    test('should throw when AzureWebJobsDataflowsStorage env var is missing', async () => {
      delete process.env.AzureWebJobsDataflowsStorage;

      await expect(handleStart({ fromDate: '2026-04-20' }, invocationContext)).rejects.toThrow(
        'Missing required environment variable: AzureWebJobsDataflowsStorage',
      );
    });

    test('should queue pages to PAGE output on success', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(SyncCases, 'getCaseIds').mockResolvedValue({
        events: [
          { type: 'CASE_CHANGED', caseId: 'case-1' },
          { type: 'CASE_CHANGED', caseId: 'case-2' },
        ],
        lastCasesSyncDate: '2026-04-21',
        lastTransactionsSyncDate: '2026-04-21',
      });

      await handleStart({ fromDate: '2026-04-20' }, invocationContext);

      expect(invocationContext.extraOutputs.set).toHaveBeenCalled();
      const pages = extraOutputsMap.values().next().value;
      expect(Array.isArray(pages)).toBe(true);
      expect(pages.length).toBeGreaterThan(0);
      expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.any(String),
        'handleStart',
        expect.anything(),
        expect.objectContaining({ success: true }),
      );
    });

    test('should return early with success telemetry when getCaseIds returns no events', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(SyncCases, 'getCaseIds').mockResolvedValue({
        events: [],
        lastCasesSyncDate: '2026-04-21',
        lastTransactionsSyncDate: '2026-04-21',
      });

      await handleStart({ fromDate: '2026-04-20' }, invocationContext);

      expect(invocationContext.extraOutputs.set).not.toHaveBeenCalled();
      expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.any(String),
        'handleStart',
        expect.anything(),
        expect.objectContaining({ success: true }),
      );
    });
  });

  describe('handlePage', () => {
    test('should throw when AzureWebJobsDataflowsStorage env var is missing', async () => {
      delete process.env.AzureWebJobsDataflowsStorage;

      const events = [{ type: 'CASE_CHANGED' as const, caseId: 'case-1' }];
      await expect(handlePage({ events }, invocationContext)).rejects.toThrow(
        'Missing required environment variable: AzureWebJobsDataflowsStorage',
      );
    });

    test('should emit telemetry with correct counts on happy path', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockResolvedValue([
        { type: 'CASE_CHANGED', caseId: 'case-1' },
        { type: 'CASE_CHANGED', caseId: 'case-2' },
      ]);

      const events = [
        { type: 'CASE_CHANGED' as const, caseId: 'case-1' },
        { type: 'CASE_CHANGED' as const, caseId: 'case-2' },
      ];
      await handlePage({ events }, invocationContext);

      expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.any(String),
        'handlePage',
        expect.anything(),
        expect.objectContaining({ success: true, documentsWritten: 2, documentsFailed: 0 }),
      );
    });

    test('should include DataflowDivisionChangesQueued in additionalMetrics when division changes are present', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockResolvedValue([
        {
          type: 'CASE_CHANGED',
          caseId: 'case-1',
          divisionChange: { orphanedCaseId: 'old-1', currentCaseId: 'case-1' },
        },
        {
          type: 'CASE_CHANGED',
          caseId: 'case-2',
          divisionChange: { orphanedCaseId: 'old-2', currentCaseId: 'case-2' },
        },
        { type: 'CASE_CHANGED', caseId: 'case-3' },
      ]);

      const events = [
        { type: 'CASE_CHANGED' as const, caseId: 'case-1' },
        { type: 'CASE_CHANGED' as const, caseId: 'case-2' },
        { type: 'CASE_CHANGED' as const, caseId: 'case-3' },
      ];
      await handlePage({ events }, invocationContext);

      expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.any(String),
        'handlePage',
        expect.anything(),
        expect.objectContaining({
          success: true,
          documentsWritten: 1,
          additionalMetrics: expect.arrayContaining([
            { name: 'DataflowDivisionChangesQueued', value: 2 },
          ]),
          details: expect.objectContaining({ divisionChangesQueued: '2' }),
        }),
      );
    });

    test('should include DataflowDivisionChangesQueued: 0 in additionalMetrics when no division changes', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockResolvedValue([
        { type: 'CASE_CHANGED', caseId: 'case-1' },
        { type: 'CASE_CHANGED', caseId: 'case-2' },
      ]);

      const events = [
        { type: 'CASE_CHANGED' as const, caseId: 'case-1' },
        { type: 'CASE_CHANGED' as const, caseId: 'case-2' },
      ];
      await handlePage({ events }, invocationContext);

      expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.any(String),
        'handlePage',
        expect.anything(),
        expect.objectContaining({
          success: true,
          additionalMetrics: expect.arrayContaining([
            { name: 'DataflowDivisionChangesQueued', value: 0 },
          ]),
        }),
      );
    });

    test('should send division changes to FIX output', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockResolvedValue([
        {
          type: 'CASE_CHANGED',
          caseId: 'case-1',
          divisionChange: { orphanedCaseId: 'old-1', currentCaseId: 'case-1' },
        },
        { type: 'CASE_CHANGED', caseId: 'case-2' },
      ]);

      const events = [
        { type: 'CASE_CHANGED' as const, caseId: 'case-1' },
        { type: 'CASE_CHANGED' as const, caseId: 'case-2' },
      ];
      await handlePage({ events }, invocationContext);

      const fixOutput = [...extraOutputsMap.values()].find(
        (v) => Array.isArray(v) && v[0]?.orphanedCaseId,
      );
      expect(fixOutput).toBeDefined();
      expect(fixOutput).toHaveLength(1);
      expect(fixOutput[0]).toMatchObject({ orphanedCaseId: 'old-1', currentCaseId: 'case-1' });
    });

    test('should send failed events to DLQ output', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      const error = new UnknownError('TEST', { message: 'sync failed' });
      vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockResolvedValue([
        { type: 'CASE_CHANGED', caseId: 'case-1', error },
        { type: 'CASE_CHANGED', caseId: 'case-2' },
      ]);

      const events = [
        { type: 'CASE_CHANGED' as const, caseId: 'case-1' },
        { type: 'CASE_CHANGED' as const, caseId: 'case-2' },
      ];
      await handlePage({ events }, invocationContext);

      const dlqOutput = [...extraOutputsMap.values()].find((v) => Array.isArray(v) && v[0]?.error);
      expect(dlqOutput).toBeDefined();
      expect(dlqOutput).toHaveLength(1);
      expect(dlqOutput[0].caseId).toBe('case-1');
    });

    test('should re-enqueue page with exponential backoff on 429 from exportAndLoad', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      const rateLimitError = new TooManyRequestsError('TEST', { message: 'Rate limit' });
      vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockRejectedValue(rateLimitError);

      const events = [{ type: 'CASE_CHANGED' as const, caseId: 'case-1' }];
      await handlePage({ events, retryCount: 0 }, invocationContext);

      expect(sendMessageSpy).toHaveBeenCalledOnce();
      const [payload, delay] = sendMessageSpy.mock.calls[0];
      expect(JSON.parse(payload)).toMatchObject({ retryCount: 1 });
      expect(delay).toBe(60);
      expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.any(String),
        'handlePage',
        expect.anything(),
        expect.objectContaining({
          success: false,
          error: 'rate-limited-requeued',
          documentsWritten: 0,
          documentsFailed: 0,
        }),
      );
    });

    test('should not re-enqueue when 429 retry limit is exhausted', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      const rateLimitError = new TooManyRequestsError('TEST', { message: 'Rate limit' });
      vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockRejectedValue(rateLimitError);

      const events = [{ type: 'CASE_CHANGED' as const, caseId: 'case-1' }];
      await handlePage({ events, retryCount: 10 }, invocationContext);

      expect(sendMessageSpy).not.toHaveBeenCalled();
      expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.any(String),
        'handlePage',
        expect.anything(),
        expect.objectContaining({
          success: false,
          error: 'rate-limit-retry-exhausted',
          documentsFailed: 1,
        }),
      );
    });

    test('should rethrow non-429 errors from exportAndLoad and complete trace with success:false', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      const genericError = new UnknownError('TEST', { message: 'Unexpected DB error' });
      vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockRejectedValue(genericError);

      const events = [{ type: 'CASE_CHANGED' as const, caseId: 'case-1' }];
      await expect(handlePage({ events }, invocationContext)).rejects.toThrow(
        'Unexpected DB error',
      );
      expect(sendMessageSpy).not.toHaveBeenCalled();
      expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.any(String),
        'handlePage',
        expect.anything(),
        expect.objectContaining({ success: false, documentsFailed: events.length }),
      );
    });

    test('should not count failed+divisionChange events as both failed and divisionChange (no negative successCount)', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      const error = new UnknownError('TEST', { message: 'sync failed' });
      vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockResolvedValue([
        {
          type: 'CASE_CHANGED',
          caseId: 'case-1',
          error,
          divisionChange: { orphanedCaseId: 'old-1', currentCaseId: 'case-1' },
        },
        { type: 'CASE_CHANGED', caseId: 'case-2' },
      ]);

      const events = [
        { type: 'CASE_CHANGED' as const, caseId: 'case-1' },
        { type: 'CASE_CHANGED' as const, caseId: 'case-2' },
      ];
      await handlePage({ events }, invocationContext);

      // successCount should be 1 (case-2 succeeded), never negative
      expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.any(String),
        'handlePage',
        expect.anything(),
        expect.objectContaining({ documentsWritten: 1, documentsFailed: 1 }),
      );

      // The event with both error AND divisionChange should NOT be sent to the FIX queue
      const fixOutput = [...extraOutputsMap.values()].find(
        (v) => Array.isArray(v) && v[0]?.orphanedCaseId,
      );
      expect(fixOutput).toBeUndefined();
    });
  });

  describe('handleError', () => {
    test('should queue event to RETRY and emit queued-for-retry telemetry for non-404 errors', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

      const error = new UnknownError('TEST', { message: 'sync failed' });
      const event = { type: 'CASE_CHANGED' as const, caseId: 'case-1', error };

      await handleError(event, invocationContext);

      const retryOutput = [...extraOutputsMap.values()].find((v) => Array.isArray(v));
      expect(retryOutput).toBeDefined();
      expect(retryOutput).toHaveLength(1);
      expect(retryOutput[0].caseId).toBe('case-1');
      expect(retryOutput[0].error).toBeUndefined();

      expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.any(String),
        'handleError',
        expect.anything(),
        expect.objectContaining({
          success: true,
          details: expect.objectContaining({ disposition: 'queued-for-retry' }),
        }),
      );
    });

    test('should abandon and emit abandoned telemetry for NotFoundError (404)', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

      const error = new NotFoundError('TEST', { message: 'case not found' });
      const event = { type: 'CASE_CHANGED' as const, caseId: 'case-1', error };

      await handleError(event, invocationContext);

      expect(invocationContext.extraOutputs.set).not.toHaveBeenCalled();

      expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.any(String),
        'handleError',
        expect.anything(),
        expect.objectContaining({
          success: true,
          details: expect.objectContaining({ disposition: 'abandoned' }),
        }),
      );
    });
  });

  describe('handleRetry', () => {
    test('should route to HARD_STOP and emit hard-stop telemetry when retry count exceeds limit', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

      const event = { type: 'CASE_CHANGED' as const, caseId: 'case-1', retryCount: 3 };

      await handleRetry(event, invocationContext);

      const hardStopOutput = [...extraOutputsMap.values()].find((v) => Array.isArray(v));
      expect(hardStopOutput).toBeDefined();
      expect(hardStopOutput[0].caseId).toBe('case-1');

      expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.any(String),
        'handleRetry',
        expect.anything(),
        expect.objectContaining({
          success: true,
          details: expect.objectContaining({ disposition: 'hard-stop' }),
        }),
      );
    });

    test('should emit retry-succeeded telemetry when retry succeeds', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockResolvedValue([
        { type: 'CASE_CHANGED', caseId: 'case-1' },
      ]);

      const event = { type: 'CASE_CHANGED' as const, caseId: 'case-1', retryCount: 0 };

      await handleRetry(event, invocationContext);

      expect(invocationContext.extraOutputs.set).not.toHaveBeenCalled();

      expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.any(String),
        'handleRetry',
        expect.anything(),
        expect.objectContaining({
          success: true,
          documentsWritten: 1,
          details: expect.objectContaining({ disposition: 'retry-succeeded' }),
        }),
      );
    });

    test('should route to DLQ and emit retry-failed telemetry when retry fails', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      const error = new UnknownError('TEST', { message: 'still failing' });
      vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockResolvedValue([
        { type: 'CASE_CHANGED', caseId: 'case-1', error },
      ]);

      const event = { type: 'CASE_CHANGED' as const, caseId: 'case-1', retryCount: 0 };

      await handleRetry(event, invocationContext);

      const dlqOutput = [...extraOutputsMap.values()].find((v) => Array.isArray(v) && v[0]?.error);
      expect(dlqOutput).toBeDefined();
      expect(dlqOutput[0].caseId).toBe('case-1');

      expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.any(String),
        'handleRetry',
        expect.anything(),
        expect.objectContaining({
          success: true,
          details: expect.objectContaining({ disposition: 'retry-failed' }),
        }),
      );
    });

    test('should rethrow errors thrown by exportAndLoad', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      const genericError = new UnknownError('TEST', { message: 'Unexpected DB error' });
      vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockRejectedValue(genericError);

      const event = { type: 'CASE_CHANGED' as const, caseId: 'case-1' };

      await expect(handleRetry(event, invocationContext)).rejects.toThrow('Unexpected DB error');
    });

    test('should route to FIX and emit division-change-queued telemetry when division change detected on retry', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockResolvedValue([
        {
          type: 'CASE_CHANGED',
          caseId: 'case-1',
          divisionChange: { orphanedCaseId: 'old-1', currentCaseId: 'case-1' },
        },
      ]);

      const event = { type: 'CASE_CHANGED' as const, caseId: 'case-1', retryCount: 0 };

      await handleRetry(event, invocationContext);

      const fixOutput = [...extraOutputsMap.values()].find(
        (v) => Array.isArray(v) && v[0]?.orphanedCaseId,
      );
      expect(fixOutput).toBeDefined();
      expect(fixOutput[0]).toMatchObject({ orphanedCaseId: 'old-1', currentCaseId: 'case-1' });

      expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.any(String),
        'handleRetry',
        expect.anything(),
        expect.objectContaining({
          success: true,
          details: expect.objectContaining({ disposition: 'division-change-queued' }),
        }),
      );
    });
  });
});
