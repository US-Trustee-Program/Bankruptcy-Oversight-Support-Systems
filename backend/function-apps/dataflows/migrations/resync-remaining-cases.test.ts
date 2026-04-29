import { vi, describe, test, expect, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import ResyncRemainingCasesUseCase from '../../../lib/use-cases/dataflows/resync-remaining-cases';
import ExportAndLoadCase from '../../../lib/use-cases/dataflows/export-and-load-case';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';

// Mock storage-queue humble object
let mockSendMessage: ReturnType<typeof vi.fn>;

vi.mock('../../../lib/humble-objects/storage-queue-humble', () => {
  class MockStorageQueueHumbleObject {
    sendMessage(...args: unknown[]) {
      return mockSendMessage(...args);
    }
    static fromConnectionString() {
      return new MockStorageQueueHumbleObject();
    }
  }
  return { StorageQueueHumbleObject: MockStorageQueueHumbleObject };
});

vi.mock('../../../lib/use-cases/dataflows/resync-remaining-cases');
vi.mock('../../../lib/use-cases/dataflows/export-and-load-case');
vi.mock('../../../lib/use-cases/dataflows/dataflow-telemetry', () => ({
  completeDataflowTrace: vi.fn(),
}));

// We need to import after mocking
const { handlePage } = await import('./resync-remaining-cases');

describe('resync-remaining-cases handlePage', () => {
  let invocationContext: InvocationContext;
  const extraOutputsMap = new Map();

  beforeEach(async () => {
    vi.restoreAllMocks();
    mockSendMessage = vi.fn().mockResolvedValue({});
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

    const [payload, opts] = mockSendMessage.mock.calls[0];
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

    expect(mockSendMessage).toHaveBeenCalledWith(expect.any(String), 120);
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

    expect(mockSendMessage).toHaveBeenCalledWith(expect.any(String), 600);
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

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test('should throw on non-transient page fetch errors', async () => {
    const genericError = new Error('Some unexpected database error');
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
    expect(mockSendMessage).not.toHaveBeenCalled();
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

    expect(mockSendMessage).not.toHaveBeenCalled(); // no rate limit, no manual re-enqueue
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
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
