import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as FixChapter7AppointmentsModule from '../../../lib/use-cases/dataflows/fix-chapter-7-appointments';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import type { ReaderMessage, WriterMessage } from './fix-chapter-7-appointments';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'fix-chapter-7-appointments',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

describe('fix-chapter-7-appointments', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(DataflowTelemetry, 'completeDataflowTrace').mockReturnValue(undefined);
  });

  describe('handleStart', () => {
    test('enqueues exactly 4 reader messages, one per chapter-fix operation', async () => {
      const { handleStart } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
        sendMessage: mockSendMessage,
      } as unknown as StorageQueueHumbleObject);

      await handleStart({}, invocationContext);

      expect(mockSendMessage).toHaveBeenCalledTimes(4);
      const sentMessages: ReaderMessage[] = mockSendMessage.mock.calls.map((call) =>
        JSON.parse(call[0] as string),
      );

      expect(sentMessages).toContainEqual({
        operation: 'rename',
        matchChapter: '7A',
        setChapter: '7',
      });
      expect(sentMessages).toContainEqual({
        operation: 'rename',
        matchChapter: '7N',
        setChapter: '7',
      });
      expect(sentMessages).toContainEqual({
        operation: 'rename',
        matchChapter: '09',
        setChapter: '9',
      });
      expect(sentMessages).toContainEqual({
        operation: 'delete',
        matchChapter: 'AC',
      });
    });

    test('throws when AzureWebJobsDataflowsStorage is not configured, routing to DLQ', async () => {
      delete process.env.AzureWebJobsDataflowsStorage;
      const { handleStart } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      await handleStart({}, invocationContext);

      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      expect(outputs).toHaveLength(1);
      expect(outputs[0]).toEqual(
        expect.objectContaining({
          module: 'FIX-CHAPTER-7-APPOINTMENTS',
          activityName: 'FIX-CHAPTER-7-APPOINTMENTS-handleStart',
          error: expect.objectContaining({
            message: expect.stringContaining('AzureWebJobsDataflowsStorage'),
          }),
        }),
      );
    });
  });

  describe('handleReader', () => {
    const baseMessage: ReaderMessage = {
      operation: 'rename',
      matchChapter: '7A',
      setChapter: '7',
    };

    const idPairs = [
      { trusteeApptId: 'trustee-mongo-1', caseApptId: 'case-mongo-1' },
      { trusteeApptId: 'trustee-mongo-2', caseApptId: 'case-mongo-2' },
      { trusteeApptId: 'trustee-mongo-3', caseApptId: 'case-mongo-3' },
    ];

    test('pages non-empty results to the writer queue and re-enqueues itself with a delay', async () => {
      const { handleReader } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(FixChapter7AppointmentsModule.default, 'readIdPairs').mockResolvedValue(idPairs);

      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
        sendMessage: mockSendMessage,
      } as unknown as StorageQueueHumbleObject);

      await handleReader(baseMessage, invocationContext);

      // At least one writer message page, plus the reader self re-enqueue.
      expect(mockSendMessage).toHaveBeenCalled();

      const writerCalls = mockSendMessage.mock.calls.filter((call) => {
        const parsed = JSON.parse(call[0] as string);
        return Array.isArray(parsed.idPairs);
      });
      expect(writerCalls.length).toBeGreaterThanOrEqual(1);
      const writerMessage: WriterMessage = JSON.parse(writerCalls[0][0] as string);
      expect(writerMessage.idPairs).toEqual(idPairs);
      expect(writerMessage.operation).toBe('rename');
      expect(writerMessage.matchChapter).toBe('7A');
      expect(writerMessage.setChapter).toBe('7');

      // Reader re-enqueue: same shape as the original message, sent with a 30s delay.
      const reReaderCall = mockSendMessage.mock.calls.find((call) => {
        const parsed = JSON.parse(call[0] as string);
        return !('idPairs' in parsed);
      });
      expect(reReaderCall).toBeDefined();
      expect(reReaderCall![1]).toBe(30);
      expect(JSON.parse(reReaderCall![0] as string)).toEqual(baseMessage);
    });

    test('splits a large result set across multiple writer pages before re-enqueuing', async () => {
      const { handleReader } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      // Each pair carries two 24-char Mongo ObjectId-style ids, ~26 bytes each
      // serialized. At 3000 pairs that's well over both the ~48KB byte budget
      // and the 2000-item WRITER_MAX_PAGE_SIZE cap, so pageByByteBudget must
      // split this into 2+ writer pages. This guards the multi-page loop in
      // handleReader, which a 3-pair test can't exercise since 3 pairs always
      // fit in a single page regardless of budget.
      const manyIdPairs = Array.from({ length: 3000 }, (_, i) => ({
        trusteeApptId: `t${i.toString().padStart(23, '0')}`,
        caseApptId: `c${i.toString().padStart(23, '0')}`,
      }));
      vi.spyOn(FixChapter7AppointmentsModule.default, 'readIdPairs').mockResolvedValue(manyIdPairs);

      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
        sendMessage: mockSendMessage,
      } as unknown as StorageQueueHumbleObject);

      await handleReader(baseMessage, invocationContext);

      const writerCalls = mockSendMessage.mock.calls.filter((call) => {
        const parsed = JSON.parse(call[0] as string);
        return Array.isArray(parsed.idPairs);
      });

      expect(writerCalls.length).toBeGreaterThanOrEqual(2);

      const idPairsAcrossPages = writerCalls.flatMap(
        (call) => (JSON.parse(call[0] as string) as WriterMessage).idPairs,
      );
      expect(idPairsAcrossPages).toEqual(manyIdPairs);
      // Every page inherits the reader message's operation/chapter fields.
      writerCalls.forEach((call) => {
        const writerMessage: WriterMessage = JSON.parse(call[0] as string);
        expect(writerMessage.operation).toBe('rename');
        expect(writerMessage.matchChapter).toBe('7A');
        expect(writerMessage.setChapter).toBe('7');
      });

      // Reader still re-enqueues itself exactly once after all writer pages are sent.
      const reReaderCalls = mockSendMessage.mock.calls.filter((call) => {
        const parsed = JSON.parse(call[0] as string);
        return !('idPairs' in parsed);
      });
      expect(reReaderCalls).toHaveLength(1);
      expect(reReaderCalls[0][1]).toBe(30);
    });

    test('does NOT re-enqueue when readIdPairs returns empty', async () => {
      const { handleReader } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(FixChapter7AppointmentsModule.default, 'readIdPairs').mockResolvedValue([]);

      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
        sendMessage: mockSendMessage,
      } as unknown as StorageQueueHumbleObject);

      await handleReader(baseMessage, invocationContext);

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    test('throws when AzureWebJobsDataflowsStorage is not configured', async () => {
      delete process.env.AzureWebJobsDataflowsStorage;
      const { handleReader } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      await expect(handleReader(baseMessage, invocationContext)).rejects.toThrow(
        'Missing required environment variable: AzureWebJobsDataflowsStorage',
      );
    });

    test('routes to DLQ when readIdPairs throws unexpectedly', async () => {
      const { handleReader } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(FixChapter7AppointmentsModule.default, 'readIdPairs').mockRejectedValue(
        new Error('mongo read failed'),
      );

      await handleReader(baseMessage, invocationContext);

      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      expect(outputs).toHaveLength(1);
      expect(outputs[0]).toEqual(
        expect.objectContaining({
          module: 'FIX-CHAPTER-7-APPOINTMENTS',
          activityName: 'FIX-CHAPTER-7-APPOINTMENTS-handleReader',
          error: expect.objectContaining({
            message: expect.stringContaining('mongo read failed'),
          }),
        }),
      );
    });

    test('re-enqueues with backoff and emits rate-limited-requeued telemetry on rate limiting instead of DLQ', async () => {
      const { handleReader } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(FixChapter7AppointmentsModule.default, 'readIdPairs').mockRejectedValue(
        new TooManyRequestsError('FIX-CHAPTER-7-APPOINTMENTS'),
      );

      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
        sendMessage: mockSendMessage,
      } as unknown as StorageQueueHumbleObject);

      const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

      await handleReader({ ...baseMessage, retryCount: 0 }, invocationContext);

      expect(mockSendMessage).toHaveBeenCalled();
      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      expect(outputs).toHaveLength(0);
      expect(telemetrySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'FIX-CHAPTER-7-APPOINTMENTS',
        'handleReader',
        expect.anything(),
        expect.objectContaining({ success: false, error: 'rate-limited-requeued' }),
      );
    });

    test('routes to DLQ and emits telemetry when rate-limit retry limit exhausted', async () => {
      const { handleReader } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(FixChapter7AppointmentsModule.default, 'readIdPairs').mockRejectedValue(
        new TooManyRequestsError('FIX-CHAPTER-7-APPOINTMENTS'),
      );

      // handleRateLimitRetry's exhausted path writes to context.extraOutputs (the
      // ApplicationContext), not invocationContext.extraOutputs directly — spy on
      // the mock context returned by getApplicationContext instead.
      const mockContext = await createMockApplicationContext();
      const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

      const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

      await handleReader({ ...baseMessage, retryCount: 10 }, invocationContext);

      expect(extraOutputsSetSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queueName: expect.stringContaining('dlq') }),
        expect.anything(),
      );
      expect(telemetrySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'FIX-CHAPTER-7-APPOINTMENTS',
        'handleReader',
        expect.anything(),
        expect.objectContaining({ success: false, error: 'rate-limit-retry-exhausted' }),
      );
    });

    test('resets retryCount/firstAttemptAt on the successful continuation re-enqueue', async () => {
      const { handleReader } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(FixChapter7AppointmentsModule.default, 'readIdPairs').mockResolvedValue(idPairs);

      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
        sendMessage: mockSendMessage,
      } as unknown as StorageQueueHumbleObject);

      // Simulate a message that survived a prior rate-limit episode.
      await handleReader(
        { ...baseMessage, retryCount: 3, firstAttemptAt: '2024-01-01T00:00:00Z' },
        invocationContext,
      );

      const reReaderCall = mockSendMessage.mock.calls.find((call) => {
        const parsed = JSON.parse(call[0] as string);
        return !('idPairs' in parsed);
      });
      expect(reReaderCall).toBeDefined();
      const continuationMessage = JSON.parse(reReaderCall![0] as string);
      expect(continuationMessage).toEqual(baseMessage);
      expect(continuationMessage.retryCount).toBeUndefined();
      expect(continuationMessage.firstAttemptAt).toBeUndefined();
    });
  });

  describe('handleWriter', () => {
    const baseWriterMessage: WriterMessage = {
      operation: 'rename',
      matchChapter: '7A',
      setChapter: '7',
      idPairs: [
        { trusteeApptId: 'trustee-mongo-1', caseApptId: 'case-mongo-1' },
        { trusteeApptId: 'trustee-mongo-2', caseApptId: 'case-mongo-2' },
      ],
    };

    test('calls applyFix and emits success telemetry', async () => {
      const { handleWriter } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      const applyFixSpy = vi
        .spyOn(FixChapter7AppointmentsModule.default, 'applyFix')
        .mockResolvedValue({ modifiedCount: 2 });
      const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

      await handleWriter(baseWriterMessage, invocationContext);

      expect(applyFixSpy).toHaveBeenCalledWith(
        expect.anything(),
        baseWriterMessage.idPairs,
        'rename',
        '7A',
        '7',
      );
      expect(telemetrySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'FIX-CHAPTER-7-APPOINTMENTS',
        'handleWriter',
        expect.anything(),
        expect.objectContaining({ success: true, documentsWritten: 2, documentsFailed: 0 }),
      );
    });

    test('re-enqueues with backoff and emits rate-limited-requeued telemetry on 429', async () => {
      const { handleWriter } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(FixChapter7AppointmentsModule.default, 'applyFix').mockRejectedValue(
        new TooManyRequestsError('FIX-CHAPTER-7-APPOINTMENTS'),
      );

      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
        sendMessage: mockSendMessage,
      } as unknown as StorageQueueHumbleObject);

      const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

      await handleWriter({ ...baseWriterMessage, retryCount: 0 }, invocationContext);

      expect(mockSendMessage).toHaveBeenCalled();
      expect(telemetrySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'FIX-CHAPTER-7-APPOINTMENTS',
        'handleWriter',
        expect.anything(),
        expect.objectContaining({ success: false, error: 'rate-limited-requeued' }),
      );
    });

    test('routes to DLQ and emits telemetry when retry limit exhausted', async () => {
      const { handleWriter } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(FixChapter7AppointmentsModule.default, 'applyFix').mockRejectedValue(
        new TooManyRequestsError('FIX-CHAPTER-7-APPOINTMENTS'),
      );

      // handleRateLimitRetry's exhausted path writes to context.extraOutputs (the
      // ApplicationContext), not invocationContext.extraOutputs directly — spy on
      // the mock context returned by getApplicationContext instead.
      const mockContext = await createMockApplicationContext();
      const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

      const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

      await handleWriter({ ...baseWriterMessage, retryCount: 10 }, invocationContext);

      expect(extraOutputsSetSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queueName: expect.stringContaining('dlq') }),
        expect.anything(),
      );
      expect(telemetrySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'FIX-CHAPTER-7-APPOINTMENTS',
        'handleWriter',
        expect.anything(),
        expect.objectContaining({
          success: false,
          error: 'rate-limit-retry-exhausted',
          documentsFailed: 2,
        }),
      );
    });

    test('rethrows non-rate-limit errors so Azure Functions retry/poison-queue handles it', async () => {
      const { handleWriter } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(FixChapter7AppointmentsModule.default, 'applyFix').mockRejectedValue(
        new Error('unexpected mongo error'),
      );

      await expect(handleWriter(baseWriterMessage, invocationContext)).rejects.toThrow(
        'unexpected mongo error',
      );
    });

    test('throws when AzureWebJobsDataflowsStorage is not configured', async () => {
      delete process.env.AzureWebJobsDataflowsStorage;
      const { handleWriter } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      await expect(handleWriter(baseWriterMessage, invocationContext)).rejects.toThrow(
        'Missing required environment variable: AzureWebJobsDataflowsStorage',
      );
    });
  });
});
