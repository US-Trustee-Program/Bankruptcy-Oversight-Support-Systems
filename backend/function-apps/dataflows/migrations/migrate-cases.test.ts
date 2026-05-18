import { vi, describe, test, expect, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import ExportAndLoadCase from '../../../lib/use-cases/dataflows/export-and-load-case';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { UnknownError } from '../../../lib/common-errors/unknown-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { handlePage, handleRetry, handleStart } from './migrate-cases';
import { CaseSyncEvent } from '@common/cams/dataflow-events';

const makeInvocationContext = (): InvocationContext => {
  const extraOutputsMap = new Map();
  return {
    invocationId: 'test-invocation-id',
    functionName: 'migrate-cases-handlePage',
    extraOutputs: {
      set: vi.fn((key, value) => extraOutputsMap.set(key, value)),
      get: vi.fn((key) => extraOutputsMap.get(key)),
    },
    log: vi.fn(),
    _extraOutputsMap: extraOutputsMap,
  } as unknown as InvocationContext;
};

const makeCaseSyncEvent = (caseId: string): CaseSyncEvent => ({
  type: 'MIGRATION',
  caseId,
});

describe('migrate-cases handlePage', () => {
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

    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
  });

  test('should process page successfully and complete trace', async () => {
    const invocationContext = makeInvocationContext();
    const range = { start: 1, end: 100 };

    vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockResolvedValue([
      makeCaseSyncEvent('001-25-00001'),
      makeCaseSyncEvent('001-25-00002'),
    ]);

    await handlePage(range, invocationContext);

    expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'MIGRATE-CASES',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: true }),
    );
    expect(sendMessageSpy).not.toHaveBeenCalled();
  });

  test('should re-enqueue with backoff on 429 error and complete trace with rate-limited-requeued', async () => {
    const invocationContext = makeInvocationContext();
    const range = { start: 1, end: 100, retryCount: 0 };

    const rateLimitError = new TooManyRequestsError('MIGRATE-CASES', { message: 'Rate limit' });
    vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockRejectedValue(rateLimitError);

    await handlePage(range, invocationContext);

    expect(sendMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining('"retryCount":1'),
      expect.any(Number),
    );
    expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'MIGRATE-CASES',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limited-requeued' }),
    );
  });

  test('should send to DLQ and complete trace with rate-limit-retry-exhausted when retry limit reached', async () => {
    const invocationContext = makeInvocationContext();
    const range = { start: 1, end: 100, retryCount: 10 };

    const rateLimitError = new TooManyRequestsError('MIGRATE-CASES', { message: 'Rate limit' });
    vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockRejectedValue(rateLimitError);

    await handlePage(range, invocationContext);

    expect(sendMessageSpy).not.toHaveBeenCalled();
    expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'MIGRATE-CASES',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limit-retry-exhausted' }),
    );
  });

  test('should rethrow on non-429 error', async () => {
    const invocationContext = makeInvocationContext();
    const range = { start: 1, end: 100 };

    const genericError = new UnknownError('MIGRATE-CASES', { message: 'Database failure' });
    vi.spyOn(ExportAndLoadCase, 'exportAndLoad').mockRejectedValue(genericError);

    await expect(handlePage(range, invocationContext)).rejects.toThrow('Database failure');
    expect(sendMessageSpy).not.toHaveBeenCalled();
  });
});

describe('migrate-cases handleRetry', () => {
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

    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
  });

  test('should load case and complete trace on success', async () => {
    const invocationContext = makeInvocationContext();
    const event: CaseSyncEvent = { type: 'MIGRATION', caseId: '001-25-00001', retryCount: 1 };

    vi.spyOn(ExportAndLoadCase, 'exportCase').mockResolvedValue({ ...event, bCase: {} as never });
    vi.spyOn(ExportAndLoadCase, 'loadCase').mockResolvedValue({ ...event });

    await handleRetry(event, invocationContext);

    expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'MIGRATE-CASES',
      'handleRetry',
      expect.anything(),
      expect.objectContaining({ success: true }),
    );
    expect(sendMessageSpy).not.toHaveBeenCalled();
  });

  test('should re-enqueue with backoff on 429 error during loadCase', async () => {
    const invocationContext = makeInvocationContext();
    const event: CaseSyncEvent = { type: 'MIGRATION', caseId: '001-25-00001', retryCount: 1 };

    const rateLimitError = new TooManyRequestsError('MIGRATE-CASES', { message: 'Rate limit' });
    vi.spyOn(ExportAndLoadCase, 'exportCase').mockResolvedValue({ ...event, bCase: {} as never });
    vi.spyOn(ExportAndLoadCase, 'loadCase').mockRejectedValue(rateLimitError);

    await handleRetry(event, invocationContext);

    expect(sendMessageSpy).toHaveBeenCalled();
    expect(DataflowTelemetry.completeDataflowTrace).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'MIGRATE-CASES',
      'handleRetry',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limited-requeued' }),
    );
  });
});

describe('migrate-cases handleStart', () => {
  test('should be exported', () => {
    expect(handleStart).toBeDefined();
    expect(typeof handleStart).toBe('function');
  });
});
