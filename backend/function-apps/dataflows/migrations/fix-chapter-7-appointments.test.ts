import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as FixChapter7AppointmentsModule from '../../../lib/use-cases/dataflows/fix-chapter-7-appointments';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import { buildQueueName } from '../dataflows-common';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import type { ReaderMessage, WriterMessage } from './fix-chapter-7-appointments';

const MODULE_NAME = 'FIX-CHAPTER-7-APPOINTMENTS';
const READER_QUEUE_NAME = buildQueueName(MODULE_NAME, 'reader');
const WRITER_QUEUE_NAME = buildQueueName(MODULE_NAME, 'writer');

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'fix-chapter-7-appointments',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

// Mocks fromConnectionString keyed by queueName so tests can assert a writer
// message actually went to the writer queue and a reader continuation
// actually went to the reader queue, rather than "some message went to some
// queue." Without this, mockReturnValue would hand back the same spy
// regardless of which queue name the handler passed in, so a bug that sent a
// writer-shaped message to the reader queue (or vice versa) would go
// undetected.
function mockQueuesByName(): {
  readerSendMessage: ReturnType<typeof vi.fn>;
  writerSendMessage: ReturnType<typeof vi.fn>;
} {
  const readerSendMessage = vi.fn().mockResolvedValue(undefined);
  const writerSendMessage = vi.fn().mockResolvedValue(undefined);

  vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockImplementation(
    (_connectionString: string, queueName: string) => {
      if (queueName === WRITER_QUEUE_NAME) {
        return { sendMessage: writerSendMessage } as unknown as StorageQueueHumbleObject;
      }
      if (queueName === READER_QUEUE_NAME) {
        return { sendMessage: readerSendMessage } as unknown as StorageQueueHumbleObject;
      }
      throw new Error(`Unexpected queue name passed to fromConnectionString: ${queueName}`);
    },
  );

  return { readerSendMessage, writerSendMessage };
}

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

      const { readerSendMessage } = mockQueuesByName();

      await handleStart({}, invocationContext);

      expect(readerSendMessage).toHaveBeenCalledTimes(4);
      const sentMessages: ReaderMessage[] = readerSendMessage.mock.calls.map((call) =>
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

    test('sends the first reader message immediately and jitters the visibility delay of the rest so the 4 streams desynchronize', async () => {
      const { handleStart } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      const { readerSendMessage } = mockQueuesByName();

      await handleStart({}, invocationContext);

      expect(readerSendMessage).toHaveBeenCalledTimes(4);
      const visibilityTimeouts = readerSendMessage.mock.calls.map((call) => call[1]);

      // First message: no delay.
      expect(visibilityTimeouts[0]).toBeUndefined();

      // Remaining 3: each gets a flat 30s base plus a random 0-59s jitter
      // (30-89s total) so they don't all query Mongo at the same instant
      // (and, by extension, don't all get RU-throttled and retry in
      // lockstep). The base ensures even the low end of the roll still
      // lands well clear of the first (immediate) message.
      for (const timeout of visibilityTimeouts.slice(1)) {
        expect(typeof timeout).toBe('number');
        expect(timeout as number).toBeGreaterThanOrEqual(30);
        expect(timeout as number).toBeLessThanOrEqual(89);
      }

      // Not required to differ (random collision is theoretically possible),
      // but with 3 independent draws from a 60-value range, asserting the set
      // isn't degenerately identical guards against a broken jitter that
      // always returns the same value.
      const distinctTimeouts = new Set(visibilityTimeouts.slice(1));
      expect(distinctTimeouts.size).toBeGreaterThan(1);
    });

    test('logs each enqueued stream (operation/matchChapter) alongside its jitter offset', async () => {
      const { handleStart } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      mockQueuesByName();

      const mockContext = await createMockApplicationContext();
      const loggerInfoSpy = vi.spyOn(mockContext.logger, 'info');
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

      await handleStart({}, invocationContext);

      const streamLogCalls = loggerInfoSpy.mock.calls.filter((call) =>
        String(call[1]).includes('Enqueueing reader stream'),
      );
      expect(streamLogCalls).toHaveLength(4);

      // First stream: jitterSeconds=0 (no delay).
      expect(streamLogCalls[0][1]).toEqual(
        expect.stringContaining('operation=rename matchChapter=7A jitterSeconds=0'),
      );

      // Remaining 3: jitterSeconds tied to a 30-89s value in the log line.
      for (const call of streamLogCalls.slice(1)) {
        expect(String(call[1])).toMatch(/jitterSeconds=(3\d|[4-8]\d|89)$/);
      }
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

    test('delegates to runReaderLoop with the message fields and READER_BATCH_SIZE', async () => {
      const { handleReader } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      const runReaderLoopSpy = vi
        .spyOn(FixChapter7AppointmentsModule.default, 'runReaderLoop')
        .mockResolvedValue({
          totalModified: 3,
          streamComplete: true,
          unwrittenIdPairs: [],
          recommendedVisibilitySeconds: 0,
        });

      await handleReader(baseMessage, invocationContext);

      expect(runReaderLoopSpy).toHaveBeenCalledWith(
        expect.anything(),
        '7A',
        'rename',
        '7',
        100,
        expect.objectContaining({ startedAt: expect.any(Number) }),
      );
    });

    test('does NOT re-enqueue or touch the writer queue when the stream reports complete', async () => {
      const { handleReader } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(FixChapter7AppointmentsModule.default, 'runReaderLoop').mockResolvedValue({
        totalModified: 3,
        streamComplete: true,
        unwrittenIdPairs: [],
        recommendedVisibilitySeconds: 0,
      });

      const { readerSendMessage, writerSendMessage } = mockQueuesByName();

      await handleReader(baseMessage, invocationContext);

      expect(readerSendMessage).not.toHaveBeenCalled();
      expect(writerSendMessage).not.toHaveBeenCalled();
    });

    test('escape hatch: dumps unwritten id pairs to the writer queue and re-enqueues a plain reader continuation', async () => {
      const { handleReader } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(FixChapter7AppointmentsModule.default, 'runReaderLoop').mockResolvedValue({
        totalModified: 500,
        streamComplete: false,
        unwrittenIdPairs: idPairs,
        recommendedVisibilitySeconds: 0,
      });

      const { readerSendMessage, writerSendMessage } = mockQueuesByName();

      await handleReader(baseMessage, invocationContext);

      expect(writerSendMessage).toHaveBeenCalledTimes(1);
      const writerMessage: WriterMessage = JSON.parse(writerSendMessage.mock.calls[0][0] as string);
      expect(writerMessage.idPairs).toEqual(idPairs);
      expect(writerMessage.operation).toBe('rename');
      expect(writerMessage.matchChapter).toBe('7A');
      expect(writerMessage.setChapter).toBe('7');

      // Plain reader continuation — no retryCount/firstAttemptAt (not a
      // queue-level rate-limit retry, just "there's more work").
      expect(readerSendMessage).toHaveBeenCalledTimes(1);
      const reReaderCall = readerSendMessage.mock.calls[0];
      expect(reReaderCall[1]).toBe(30);
      expect(JSON.parse(reReaderCall[0] as string)).toEqual(baseMessage);
    });

    test('escape hatch: does NOT touch the writer queue when there are no unwritten id pairs', async () => {
      const { handleReader } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(FixChapter7AppointmentsModule.default, 'runReaderLoop').mockResolvedValue({
        totalModified: 1000,
        streamComplete: false,
        unwrittenIdPairs: [],
        recommendedVisibilitySeconds: 0,
      });

      const { readerSendMessage, writerSendMessage } = mockQueuesByName();

      await handleReader(baseMessage, invocationContext);

      expect(writerSendMessage).not.toHaveBeenCalled();
      expect(readerSendMessage).toHaveBeenCalledTimes(1);
    });

    test('escape hatch: adds recommendedVisibilitySeconds (RU-throttling backoff) on top of the base requeue delay', async () => {
      const { handleReader } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(FixChapter7AppointmentsModule.default, 'runReaderLoop').mockResolvedValue({
        totalModified: 100,
        streamComplete: false,
        unwrittenIdPairs: [],
        recommendedVisibilitySeconds: 60,
      });

      const { readerSendMessage } = mockQueuesByName();

      await handleReader(baseMessage, invocationContext);

      expect(readerSendMessage).toHaveBeenCalledTimes(1);
      // READER_REQUEUE_DELAY_SECONDS (30) + recommendedVisibilitySeconds (60).
      expect(readerSendMessage.mock.calls[0][1]).toBe(90);
    });

    test('splits a large unwritten batch across multiple writer pages on escape', async () => {
      const { handleReader } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      // Each pair carries two 24-char Mongo ObjectId-style ids, ~26 bytes each
      // serialized. At 3000 pairs that's well over both the ~48KB byte budget
      // and the 2000-item WRITER_MAX_PAGE_SIZE cap, so pageByByteBudget must
      // split this into 2+ writer pages.
      const manyIdPairs = Array.from({ length: 3000 }, (_, i) => ({
        trusteeApptId: `t${i.toString().padStart(23, '0')}`,
        caseApptId: `c${i.toString().padStart(23, '0')}`,
      }));
      vi.spyOn(FixChapter7AppointmentsModule.default, 'runReaderLoop').mockResolvedValue({
        totalModified: 0,
        streamComplete: false,
        unwrittenIdPairs: manyIdPairs,
        recommendedVisibilitySeconds: 0,
      });

      const { readerSendMessage, writerSendMessage } = mockQueuesByName();

      await handleReader(baseMessage, invocationContext);

      expect(writerSendMessage.mock.calls.length).toBeGreaterThanOrEqual(2);

      const idPairsAcrossPages = writerSendMessage.mock.calls.flatMap(
        (call) => (JSON.parse(call[0] as string) as WriterMessage).idPairs,
      );
      expect(idPairsAcrossPages).toEqual(manyIdPairs);

      expect(readerSendMessage).toHaveBeenCalledTimes(1);
    });

    test('throws when AzureWebJobsDataflowsStorage is not configured', async () => {
      delete process.env.AzureWebJobsDataflowsStorage;
      const { handleReader } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      await expect(handleReader(baseMessage, invocationContext)).rejects.toThrow(
        'Missing required environment variable: AzureWebJobsDataflowsStorage',
      );
    });

    test('routes to DLQ when runReaderLoop throws unexpectedly', async () => {
      const { handleReader } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(FixChapter7AppointmentsModule.default, 'runReaderLoop').mockRejectedValue(
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

    test('calls applyFix, logs the write, and emits success telemetry', async () => {
      const { handleWriter } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      const applyFixSpy = vi
        .spyOn(FixChapter7AppointmentsModule.default, 'applyFix')
        .mockResolvedValue({ modifiedCount: 2 });
      const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

      const mockContext = await createMockApplicationContext();
      const loggerInfoSpy = vi.spyOn(mockContext.logger, 'info');
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

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

      const writeLogCalls = loggerInfoSpy.mock.calls.filter((call) =>
        String(call[1]).includes('handleWriter'),
      );
      expect(writeLogCalls).toHaveLength(1);
      expect(String(writeLogCalls[0][1])).toContain('matchChapter=7A');
      expect(String(writeLogCalls[0][1])).toContain('wrote 2 of 2 id pair(s)');
    });

    test('re-enqueues with backoff, logs the retry, and emits rate-limited-requeued telemetry on 429', async () => {
      const { handleWriter } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(FixChapter7AppointmentsModule.default, 'applyFix').mockRejectedValue(
        new TooManyRequestsError('FIX-CHAPTER-7-APPOINTMENTS'),
      );

      const { writerSendMessage } = mockQueuesByName();

      const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

      const mockContext = await createMockApplicationContext();
      const loggerInfoSpy = vi.spyOn(mockContext.logger, 'info');
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

      await handleWriter({ ...baseWriterMessage, retryCount: 0 }, invocationContext);

      // Requeued onto the writer queue itself (checkQueueName: WRITER.queueName
      // in handleRateLimitRetry) — not the reader queue.
      expect(writerSendMessage).toHaveBeenCalledTimes(1);
      expect(telemetrySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'FIX-CHAPTER-7-APPOINTMENTS',
        'handleWriter',
        expect.anything(),
        expect.objectContaining({ success: false, error: 'rate-limited-requeued' }),
      );

      const retryLogCalls = loggerInfoSpy.mock.calls.filter((call) =>
        String(call[1]).includes('hit a transient error'),
      );
      expect(retryLogCalls).toHaveLength(1);
      expect(String(retryLogCalls[0][1])).toContain('matchChapter=7A');
    });

    test('routes to DLQ, logs the exhaustion, and emits telemetry when retry limit exhausted', async () => {
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
      const loggerWarnSpy = vi.spyOn(mockContext.logger, 'warn');
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

      const exhaustedLogCalls = loggerWarnSpy.mock.calls.filter((call) =>
        String(call[1]).includes('exhausted'),
      );
      expect(exhaustedLogCalls).toHaveLength(1);
      expect(String(exhaustedLogCalls[0][1])).toContain('matchChapter=7A');
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
