import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import BackfillCaseAppointmentDatesUseCase from '../../../lib/use-cases/dataflows/backfill-case-appointment-dates';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import * as RateLimitModule from '../dataflows-rate-limit';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'backfill-case-appointment-dates',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

describe('backfill-case-appointment-dates handlePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  test('should process page successfully and queue next cursor', async () => {
    const { handlePage } = await import('./backfill-case-appointment-dates');
    const cursor = { lastId: null };
    const invocationContext = makeInvocationContext();

    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(BackfillCaseAppointmentDatesUseCase, 'processBackfillPage').mockResolvedValue({
      status: 'ok',
      appointments: [],
      failedResults: [],
      successCount: 0,
      processedCount: 0,
      newLastId: 'last-id',
      nextCursor: { lastId: 'last-id' },
    } as never);

    await handlePage(cursor, invocationContext);

    expect(BackfillCaseAppointmentDatesUseCase.processBackfillPage).toHaveBeenCalledWith(
      expect.anything(),
      null,
      100,
    );

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const pageOutput = outputs.find(([key]) => key.queueName?.includes('page'));
    expect(pageOutput).toBeDefined();
    expect(pageOutput?.[1]).toEqual({ lastId: 'last-id' });
  });

  test('should re-enqueue with backoff on 429 error', async () => {
    const { handlePage } = await import('./backfill-case-appointment-dates');
    const cursor = { lastId: 'some-id' };
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('BACKFILL-CASE-APPOINTMENT-DATES');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(BackfillCaseAppointmentDatesUseCase, 'processBackfillPage').mockRejectedValue(
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
    const { handlePage } = await import('./backfill-case-appointment-dates');
    const cursor = { lastId: 'some-id', retryCount: 10 };
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('BACKFILL-CASE-APPOINTMENT-DATES');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(BackfillCaseAppointmentDatesUseCase, 'processBackfillPage').mockRejectedValue(
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
    const { handlePage } = await import('./backfill-case-appointment-dates');
    const cursor = { lastId: null };
    const invocationContext = makeInvocationContext();

    const error = new CamsError('BACKFILL-CASE-APPOINTMENT-DATES', {
      message: 'Unexpected database failure',
    });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(BackfillCaseAppointmentDatesUseCase, 'processBackfillPage').mockRejectedValue(error);

    await expect(handlePage(cursor, invocationContext)).rejects.toThrow(
      'Unexpected database failure',
    );
  });
});

describe('backfill-case-appointment-dates handleRetry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  test('should successfully retry backfilling a single appointment', async () => {
    const { handleRetry } = await import('./backfill-case-appointment-dates');
    const event = {
      caseId: '001-25-00001',
      retryCount: 1,
      _id: 'doc-id',
      caseType: 'A7',
      chapter: '7',
      dateFiled: '2025-01-01',
    } as never;
    const invocationContext = makeInvocationContext();

    const mockContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    vi.spyOn(BackfillCaseAppointmentDatesUseCase, 'backfillAppointmentDates').mockResolvedValue({
      data: [{ success: true, caseId: '001-25-00001' }],
      error: null,
    } as never);

    await handleRetry(event, invocationContext);

    expect(BackfillCaseAppointmentDatesUseCase.backfillAppointmentDates).toHaveBeenCalled();
    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
    expect(dlqOutput).toBeUndefined();
  });

  test('should re-enqueue with backoff when 429 thrown from backfillAppointmentDates', async () => {
    const { handleRetry } = await import('./backfill-case-appointment-dates');
    const event = {
      caseId: '001-25-00001',
      retryCount: 0,
      _id: 'doc-id',
      caseType: 'A7',
      chapter: '7',
      dateFiled: '2025-01-01',
    } as never;
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('BACKFILL-CASE-APPOINTMENT-DATES');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(BackfillCaseAppointmentDatesUseCase, 'backfillAppointmentDates').mockRejectedValue(
      tooManyError,
    );

    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    await handleRetry(event, invocationContext);

    expect(mockSendMessage).toHaveBeenCalled();
  });

  test('should route to DLQ and not rethrow when 429 retry limit exhausted in handleRetry', async () => {
    const { handleRetry } = await import('./backfill-case-appointment-dates');
    const event = {
      caseId: '001-25-00001',
      retryCount: 1,
      _id: 'doc-id',
      caseType: 'A7',
      chapter: '7',
      dateFiled: '2025-01-01',
    } as never;
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('BACKFILL-CASE-APPOINTMENT-DATES');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(BackfillCaseAppointmentDatesUseCase, 'backfillAppointmentDates').mockRejectedValue(
      tooManyError,
    );
    vi.spyOn(RateLimitModule, 'handleRateLimitRetry').mockResolvedValue('exhausted');

    await expect(handleRetry(event, invocationContext)).resolves.toBeUndefined();

    expect(RateLimitModule.handleRateLimitRetry).toHaveBeenCalled();
  });

  test('should rethrow non-429 error from handleRetry', async () => {
    const { handleRetry } = await import('./backfill-case-appointment-dates');
    const event = {
      caseId: '001-25-00001',
      retryCount: 1,
      _id: 'doc-id',
      caseType: 'A7',
      chapter: '7',
      dateFiled: '2025-01-01',
    } as never;
    const invocationContext = makeInvocationContext();

    const error = new CamsError('BACKFILL-CASE-APPOINTMENT-DATES', {
      message: 'Non-rate-limit error in retry',
    });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(BackfillCaseAppointmentDatesUseCase, 'backfillAppointmentDates').mockRejectedValue(
      error,
    );

    await expect(handleRetry(event, invocationContext)).rejects.toThrow(
      'Non-rate-limit error in retry',
    );
  });
});
