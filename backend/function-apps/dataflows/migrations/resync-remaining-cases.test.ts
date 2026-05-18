import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import ResyncRemainingCasesUseCase from '../../../lib/use-cases/dataflows/resync-remaining-cases';
import ExportAndLoadCase from '../../../lib/use-cases/dataflows/export-and-load-case';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { UnknownError } from '../../../lib/common-errors/unknown-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { handlePage } from './resync-remaining-cases';

describe('resync-remaining-cases handlePage', () => {
  let invocationContext: InvocationContext;
  const extraOutputsMap = new Map();
  let sendMessageSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.restoreAllMocks();

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
      functionName: 'resync-remaining-cases-handlePage',
      extraOutputs: {
        set: vi.fn((key, value) => extraOutputsMap.set(key, value)),
        get: vi.fn((key) => extraOutputsMap.get(key)),
      },
      log: vi.fn(),
    } as unknown as InvocationContext;

    // Default: export-and-load succeeds with no errors
    vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env.AzureWebJobsDataflowsStorage;
  });

  test('should re-enqueue cursor with exponential backoff on 429 error', async () => {
    const rateLimitError = new TooManyRequestsError('TEST', { message: 'Rate limit' });
    vi.spyOn(ResyncRemainingCasesUseCase, 'getPageOfRemainingCasesByCursor').mockResolvedValue({
      error: rateLimitError,
      data: null,
    });

    const cursor = {
      cutoffDate: '2024-01-01',
      lastId: 'some-id',
      remainingCount: 0,
      retryCount: 0,
    };

    await handlePage(cursor, invocationContext);

    const [payload, opts] = sendMessageSpy.mock.calls[0];
    expect(JSON.parse(payload)).toMatchObject({ retryCount: 1 });
    expect(opts).toEqual(30);
  });

  test('should double visibilityTimeout on subsequent retries', async () => {
    const rateLimitError = new TooManyRequestsError('TEST', { message: 'Rate limit' });
    vi.spyOn(ResyncRemainingCasesUseCase, 'getPageOfRemainingCasesByCursor').mockResolvedValue({
      error: rateLimitError,
      data: null,
    });

    const cursor = {
      cutoffDate: '2024-01-01',
      lastId: 'some-id',
      remainingCount: 0,
      retryCount: 2,
    };

    await handlePage(cursor, invocationContext);

    expect(sendMessageSpy).toHaveBeenCalledWith(expect.any(String), 120);
  });

  test('should cap visibilityTimeout at 600 seconds', async () => {
    const rateLimitError = new TooManyRequestsError('TEST', { message: 'Rate limit' });
    vi.spyOn(ResyncRemainingCasesUseCase, 'getPageOfRemainingCasesByCursor').mockResolvedValue({
      error: rateLimitError,
      data: null,
    });

    const cursor = {
      cutoffDate: '2024-01-01',
      lastId: null,
      remainingCount: 0,
      retryCount: 8,
    };

    await handlePage(cursor, invocationContext);

    expect(sendMessageSpy).toHaveBeenCalledWith(expect.any(String), 600);
  });

  test('should stop re-enqueueing when retryCount exceeds limit and log error', async () => {
    const rateLimitError = new TooManyRequestsError('TEST', { message: 'Rate limit' });
    vi.spyOn(ResyncRemainingCasesUseCase, 'getPageOfRemainingCasesByCursor').mockResolvedValue({
      error: rateLimitError,
      data: null,
    });

    const cursor = {
      cutoffDate: '2024-01-01',
      lastId: null,
      remainingCount: 0,
      retryCount: 10, // at or beyond limit
    };

    await handlePage(cursor, invocationContext);

    expect(sendMessageSpy).not.toHaveBeenCalled();
  });

  test('should throw on non-transient page fetch errors', async () => {
    const genericError = new UnknownError('TEST', { message: 'Some unexpected database error' });
    vi.spyOn(ResyncRemainingCasesUseCase, 'getPageOfRemainingCasesByCursor').mockResolvedValue({
      error: genericError,
      data: null,
    });

    const cursor = {
      cutoffDate: '2024-01-01',
      lastId: null,
      remainingCount: 0,
    };

    await expect(handlePage(cursor, invocationContext)).rejects.toThrow(
      'Some unexpected database error',
    );
    expect(sendMessageSpy).not.toHaveBeenCalled();
  });

  test('should write DLQ entry and set documentsFailed:1 on non-transient page fetch error', async () => {
    const genericError = new UnknownError('TEST', { message: 'Non-transient db error' });
    vi.spyOn(ResyncRemainingCasesUseCase, 'getPageOfRemainingCasesByCursor').mockResolvedValue({
      error: genericError,
      data: null,
    });

    const cursor = {
      cutoffDate: '2024-01-01',
      lastId: 'cursor-abc',
      remainingCount: 5,
    };

    const completeTraceSpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await expect(handlePage(cursor, invocationContext)).rejects.toThrow('Non-transient db error');

    const dlqOutput = extraOutputsMap.get(
      [...extraOutputsMap.keys()].find((k: { queueName?: string }) => k.queueName?.includes('dlq')),
    );
    expect(dlqOutput).toBeDefined();
    expect(Array.isArray(dlqOutput)).toBe(true);
    expect(dlqOutput[0]).toHaveProperty('type', 'QUEUE_ERROR');

    expect(completeTraceSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      'RESYNC-REMAINING-CASES',
      'handlePage',
      expect.any(Object),
      expect.objectContaining({
        success: false,
        documentsFailed: 1,
      }),
    );
  });

  test('should continue pagination normally on success', async () => {
    vi.spyOn(ResyncRemainingCasesUseCase, 'getPageOfRemainingCasesByCursor').mockResolvedValue({
      data: { caseIds: ['case-1', 'case-2'], lastId: 'case-2', hasMore: true },
      error: null,
    });
    vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockResolvedValue([
      { type: 'MIGRATION', caseId: 'case-1' },
      { type: 'MIGRATION', caseId: 'case-2' },
    ]);

    const cursor = {
      cutoffDate: '2024-01-01',
      lastId: null,
      remainingCount: 0,
    };

    await handlePage(cursor, invocationContext);

    expect(sendMessageSpy).not.toHaveBeenCalled(); // no rate limit, no manual re-enqueue
  });

  test('should reset retryCount on successful page fetch after prior rate limiting', async () => {
    vi.spyOn(ResyncRemainingCasesUseCase, 'getPageOfRemainingCasesByCursor').mockResolvedValue({
      data: { caseIds: ['case-1'], lastId: 'case-1', hasMore: true },
      error: null,
    });
    vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockResolvedValue([
      { type: 'MIGRATION', caseId: 'case-1' },
    ]);

    const cursor = {
      cutoffDate: '2024-01-01',
      lastId: null,
      remainingCount: 0,
      retryCount: 3, // carried over from previous rate-limit retries
    };

    await handlePage(cursor, invocationContext);

    // On success, the next cursor is set via extraOutputs (not sendMessage)
    // and retryCount should NOT be forwarded
    const nextCursor = [...extraOutputsMap.values()][0];
    expect(nextCursor).toBeDefined();
    expect(nextCursor.retryCount).toBeUndefined();
    expect(sendMessageSpy).not.toHaveBeenCalled();
  });

  test('should throw when AzureWebJobsDataflowsStorage env var is missing', async () => {
    delete process.env.AzureWebJobsDataflowsStorage;

    const rateLimitError = new TooManyRequestsError('TEST', { message: 'Rate limit' });
    vi.spyOn(ResyncRemainingCasesUseCase, 'getPageOfRemainingCasesByCursor').mockResolvedValue({
      error: rateLimitError,
      data: null,
    });

    const cursor = { cutoffDate: '2024-01-01', lastId: null, remainingCount: 0 };

    await expect(handlePage(cursor, invocationContext)).rejects.toThrow(
      'Missing required environment variable: AzureWebJobsDataflowsStorage',
    );
    expect(sendMessageSpy).not.toHaveBeenCalled();
  });

  test('should clamp an out-of-range retryCount before computing backoff', async () => {
    const rateLimitError = new TooManyRequestsError('TEST', { message: 'Rate limit' });
    vi.spyOn(ResyncRemainingCasesUseCase, 'getPageOfRemainingCasesByCursor').mockResolvedValue({
      error: rateLimitError,
      data: null,
    });

    const cursor = {
      cutoffDate: '2024-01-01',
      lastId: null,
      remainingCount: 0,
      retryCount: 999,
    };

    await handlePage(cursor, invocationContext);

    // retryCount 999 clamped to RATE_LIMIT_RETRY_LIMIT (10) → treated as exhausted, no re-enqueue
    expect(sendMessageSpy).not.toHaveBeenCalled();
  });

  test('should complete trace with rate-limit-requeued error on rate-limit backoff', async () => {
    const rateLimitError = new TooManyRequestsError('TEST', { message: 'Rate limit' });
    vi.spyOn(ResyncRemainingCasesUseCase, 'getPageOfRemainingCasesByCursor').mockResolvedValue({
      error: rateLimitError,
      data: null,
    });

    const cursor = {
      cutoffDate: '2024-01-01',
      lastId: 'some-id',
      remainingCount: 0,
      retryCount: 0,
    };
    const completeTraceSpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePage(cursor, invocationContext);

    expect(completeTraceSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      'RESYNC-REMAINING-CASES',
      'handlePage',
      expect.any(Object),
      expect.objectContaining({
        success: false,
        error: 'rate-limited-requeued',
        documentsWritten: 0,
        documentsFailed: 0,
      }),
    );
  });
});
