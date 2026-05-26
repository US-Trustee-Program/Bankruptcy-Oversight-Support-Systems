import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as ArchiveCaseDocuments from '../../../lib/use-cases/dataflows/archive-case-documents';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'sync-deleted-cases',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

const makeArchiveMessage = (caseId: string, retryCount?: number) => ({
  type: 'CASE_DELETED' as const,
  caseId,
  deletedDate: '2025-01-01',
  ...(retryCount !== undefined ? { retryCount } : {}),
});

describe('sync-deleted-cases archiveDeletedCaseQueue', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  test('should archive case and emit success telemetry', async () => {
    const { archiveDeletedCaseQueue } = await import('./sync-deleted-cases');
    const message = makeArchiveMessage('001-25-00001');
    const invocationContext = makeInvocationContext();

    const archiveSummary = { caseId: '001-25-00001', archivedCount: 3, errors: [] };
    vi.spyOn(ArchiveCaseDocuments, 'archiveCaseAndRelatedDocuments').mockResolvedValue(
      archiveSummary,
    );
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await archiveDeletedCaseQueue(message, invocationContext);

    expect(ArchiveCaseDocuments.archiveCaseAndRelatedDocuments).toHaveBeenCalledWith(
      expect.anything(),
      '001-25-00001',
    );
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.stringContaining('SYNC-DELETED-CASES'),
      'archiveDeletedCaseQueue',
      expect.anything(),
      expect.objectContaining({ success: true, documentsWritten: 3, documentsFailed: 0 }),
    );
  });

  test('should re-enqueue with backoff on 429 error', async () => {
    const { archiveDeletedCaseQueue } = await import('./sync-deleted-cases');
    const message = makeArchiveMessage('001-25-00001', 0);
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('SYNC-DELETED-CASES');
    vi.spyOn(ArchiveCaseDocuments, 'archiveCaseAndRelatedDocuments').mockRejectedValue(
      tooManyError,
    );
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    await archiveDeletedCaseQueue(message, invocationContext);

    expect(mockSendMessage).toHaveBeenCalled();
  });

  test('should emit rate-limited-requeued telemetry on 429 retry', async () => {
    const { archiveDeletedCaseQueue } = await import('./sync-deleted-cases');
    const message = makeArchiveMessage('001-25-00001', 0);
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('SYNC-DELETED-CASES');
    vi.spyOn(ArchiveCaseDocuments, 'archiveCaseAndRelatedDocuments').mockRejectedValue(
      tooManyError,
    );
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: vi.fn().mockResolvedValue(undefined),
    } as unknown as StorageQueueHumbleObject);

    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await archiveDeletedCaseQueue(message, invocationContext);

    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.stringContaining('SYNC-DELETED-CASES'),
      'archiveDeletedCaseQueue',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limited-requeued' }),
    );
  });

  test('should route to DLQ and emit telemetry when retry limit exhausted', async () => {
    const { archiveDeletedCaseQueue } = await import('./sync-deleted-cases');
    const message = makeArchiveMessage('001-25-00001', 10);
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('SYNC-DELETED-CASES');
    vi.spyOn(ArchiveCaseDocuments, 'archiveCaseAndRelatedDocuments').mockRejectedValue(
      tooManyError,
    );

    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');
    const mockContext = await createMockApplicationContext();
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    await archiveDeletedCaseQueue(message, invocationContext);

    const dlqCall = extraOutputsSetSpy.mock.calls.find(([key]) =>
      (key as { queueName?: string }).queueName?.includes('dlq'),
    );
    expect(dlqCall).toBeDefined();

    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.stringContaining('SYNC-DELETED-CASES'),
      'archiveDeletedCaseQueue',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limit-retry-exhausted' }),
    );
  });

  test('should route to DLQ and throw on non-429 error', async () => {
    const { archiveDeletedCaseQueue } = await import('./sync-deleted-cases');
    const message = makeArchiveMessage('001-25-00001');
    const invocationContext = makeInvocationContext();

    const error = new CamsError('SYNC-DELETED-CASES', { message: 'Database connection failed' });
    vi.spyOn(ArchiveCaseDocuments, 'archiveCaseAndRelatedDocuments').mockRejectedValue(error);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await expect(archiveDeletedCaseQueue(message, invocationContext)).rejects.toThrow(
      'Database connection failed',
    );

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
    expect(dlqOutput).toBeDefined();
  });
});
