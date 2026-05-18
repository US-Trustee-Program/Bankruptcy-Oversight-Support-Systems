import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import BackfillPhoneticTokensUseCase from '../../../lib/use-cases/dataflows/backfill-phonetic-tokens';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import * as RateLimitModule from '../dataflows-rate-limit';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'backfill-phonetic-tokens',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

describe('backfill-phonetic-tokens handlePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  test('should process page successfully and queue next cursor when more pages exist', async () => {
    const { handlePage } = await import('./backfill-phonetic-tokens');
    const cursor = { lastId: null };
    const invocationContext = makeInvocationContext();

    const mockContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    vi.spyOn(BackfillPhoneticTokensUseCase, 'readBackfillState').mockResolvedValue({
      data: { processedCount: 0, lastId: null, status: 'IN_PROGRESS', lastUpdatedAt: '' },
      error: null,
    } as never);
    vi.spyOn(
      BackfillPhoneticTokensUseCase,
      'getPageOfCasesNeedingBackfillByCursor',
    ).mockResolvedValue({
      data: {
        cases: [
          { _id: 'doc-1', caseId: '001-25-00001', debtor: undefined, jointDebtor: undefined },
        ],
        lastId: '001-25-00001',
        hasMore: true,
      },
      error: null,
    } as never);
    vi.spyOn(BackfillPhoneticTokensUseCase, 'backfillTokensForCases').mockResolvedValue({
      data: [{ success: true, caseId: '001-25-00001' }],
      error: null,
    } as never);
    vi.spyOn(BackfillPhoneticTokensUseCase, 'updateBackfillState').mockResolvedValue({
      data: undefined,
      error: null,
    } as never);

    await handlePage(cursor, invocationContext);

    expect(BackfillPhoneticTokensUseCase.backfillTokensForCases).toHaveBeenCalled();

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const pageOutput = outputs.find(([key]) => key.queueName?.includes('page'));
    expect(pageOutput).toBeDefined();
    expect(pageOutput?.[1]).toEqual({ lastId: '001-25-00001' });
  });

  test('should re-enqueue with backoff on 429 error from backfillTokensForCases', async () => {
    const { handlePage } = await import('./backfill-phonetic-tokens');
    const cursor = { lastId: 'some-id' };
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('BACKFILL-PHONETIC-TOKENS');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(BackfillPhoneticTokensUseCase, 'readBackfillState').mockResolvedValue({
      data: { processedCount: 5, lastId: null, status: 'IN_PROGRESS', lastUpdatedAt: '' },
      error: null,
    } as never);
    vi.spyOn(
      BackfillPhoneticTokensUseCase,
      'getPageOfCasesNeedingBackfillByCursor',
    ).mockResolvedValue({
      data: {
        cases: [
          { _id: 'doc-1', caseId: '001-25-00001', debtor: undefined, jointDebtor: undefined },
        ],
        lastId: '001-25-00001',
        hasMore: false,
      },
      error: null,
    } as never);
    vi.spyOn(BackfillPhoneticTokensUseCase, 'backfillTokensForCases').mockRejectedValue(
      tooManyError,
    );

    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    await handlePage(cursor, invocationContext);

    expect(mockSendMessage).toHaveBeenCalled();
  });

  test('should route to DLQ and not rethrow when 429 retry limit exhausted', async () => {
    const { handlePage } = await import('./backfill-phonetic-tokens');
    const cursor = { lastId: 'some-id', retryCount: 10 };
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('BACKFILL-PHONETIC-TOKENS');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(BackfillPhoneticTokensUseCase, 'readBackfillState').mockResolvedValue({
      data: { processedCount: 0, lastId: null, status: 'IN_PROGRESS', lastUpdatedAt: '' },
      error: null,
    } as never);
    vi.spyOn(
      BackfillPhoneticTokensUseCase,
      'getPageOfCasesNeedingBackfillByCursor',
    ).mockResolvedValue({
      data: {
        cases: [
          { _id: 'doc-1', caseId: '001-25-00001', debtor: undefined, jointDebtor: undefined },
        ],
        lastId: '001-25-00001',
        hasMore: false,
      },
      error: null,
    } as never);
    vi.spyOn(BackfillPhoneticTokensUseCase, 'backfillTokensForCases').mockRejectedValue(
      tooManyError,
    );

    await expect(handlePage(cursor, invocationContext)).resolves.toBeUndefined();

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
    expect(dlqOutput).toBeDefined();
  });

  test('should rethrow on non-429 error', async () => {
    const { handlePage } = await import('./backfill-phonetic-tokens');
    const cursor = { lastId: null };
    const invocationContext = makeInvocationContext();

    const error = new CamsError('BACKFILL-PHONETIC-TOKENS', {
      message: 'Unexpected database failure',
    });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(BackfillPhoneticTokensUseCase, 'readBackfillState').mockResolvedValue({
      data: { processedCount: 0, lastId: null, status: 'IN_PROGRESS', lastUpdatedAt: '' },
      error: null,
    } as never);
    vi.spyOn(
      BackfillPhoneticTokensUseCase,
      'getPageOfCasesNeedingBackfillByCursor',
    ).mockResolvedValue({
      data: {
        cases: [
          { _id: 'doc-1', caseId: '001-25-00001', debtor: undefined, jointDebtor: undefined },
        ],
        lastId: '001-25-00001',
        hasMore: false,
      },
      error: null,
    } as never);
    vi.spyOn(BackfillPhoneticTokensUseCase, 'backfillTokensForCases').mockRejectedValue(error);

    await expect(handlePage(cursor, invocationContext)).rejects.toThrow(
      'Unexpected database failure',
    );
  });
});

describe('backfill-phonetic-tokens handleRetry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  test('should successfully retry backfilling a single case', async () => {
    const { handleRetry } = await import('./backfill-phonetic-tokens');
    const event = {
      _id: 'doc-1',
      caseId: '001-25-00001',
      retryCount: 1,
    } as never;
    const invocationContext = makeInvocationContext();

    const mockContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    vi.spyOn(BackfillPhoneticTokensUseCase, 'backfillTokensForCases').mockResolvedValue({
      data: [{ success: true, caseId: '001-25-00001' }],
      error: null,
    } as never);

    await handleRetry(event, invocationContext);

    expect(BackfillPhoneticTokensUseCase.backfillTokensForCases).toHaveBeenCalled();
    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
    expect(dlqOutput).toBeUndefined();
  });

  test('should re-enqueue with backoff when 429 thrown from backfillTokensForCases in handleRetry', async () => {
    const { handleRetry } = await import('./backfill-phonetic-tokens');
    const event = {
      _id: 'doc-1',
      caseId: '001-25-00001',
      retryCount: 0,
    } as never;
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('BACKFILL-PHONETIC-TOKENS');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(BackfillPhoneticTokensUseCase, 'backfillTokensForCases').mockRejectedValue(
      tooManyError,
    );

    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    await handleRetry(event, invocationContext);

    expect(mockSendMessage).toHaveBeenCalled();
  });

  test('should not rethrow when 429 retry limit exhausted in handleRetry', async () => {
    const { handleRetry } = await import('./backfill-phonetic-tokens');
    const event = {
      _id: 'doc-1',
      caseId: '001-25-00001',
      retryCount: 1,
    } as never;
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('BACKFILL-PHONETIC-TOKENS');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(BackfillPhoneticTokensUseCase, 'backfillTokensForCases').mockRejectedValue(
      tooManyError,
    );
    vi.spyOn(RateLimitModule, 'handleRateLimitRetry').mockResolvedValue('exhausted');

    await expect(handleRetry(event, invocationContext)).resolves.toBeUndefined();

    expect(RateLimitModule.handleRateLimitRetry).toHaveBeenCalled();
  });

  test('should rethrow non-429 error from handleRetry', async () => {
    const { handleRetry } = await import('./backfill-phonetic-tokens');
    const event = {
      _id: 'doc-1',
      caseId: '001-25-00001',
      retryCount: 1,
    } as never;
    const invocationContext = makeInvocationContext();

    const error = new CamsError('BACKFILL-PHONETIC-TOKENS', {
      message: 'Non-rate-limit error in retry',
    });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(BackfillPhoneticTokensUseCase, 'backfillTokensForCases').mockRejectedValue(error);

    await expect(handleRetry(event, invocationContext)).rejects.toThrow(
      'Non-rate-limit error in retry',
    );
  });
});
