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
    test('enqueues exactly 8 reader messages covering both collections x 4 operations', async () => {
      const { handleStart } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
        sendMessage: mockSendMessage,
      } as unknown as StorageQueueHumbleObject);

      await handleStart({}, invocationContext);

      expect(mockSendMessage).toHaveBeenCalledTimes(8);
      const sentMessages: ReaderMessage[] = mockSendMessage.mock.calls.map((call) =>
        JSON.parse(call[0] as string),
      );

      const caseCollectionMessages = sentMessages.filter(
        (m) => m.collectionName === 'case-trustee-appointments',
      );
      const trusteeCollectionMessages = sentMessages.filter(
        (m) => m.collectionName === 'trustee-case-appointments',
      );
      expect(caseCollectionMessages).toHaveLength(4);
      expect(trusteeCollectionMessages).toHaveLength(4);

      expect(sentMessages).toContainEqual({
        collectionName: 'case-trustee-appointments',
        operation: 'rename',
        matchChapter: '7A',
        setChapter: '7',
      });
      expect(sentMessages).toContainEqual({
        collectionName: 'case-trustee-appointments',
        operation: 'rename',
        matchChapter: '7N',
        setChapter: '7',
      });
      expect(sentMessages).toContainEqual({
        collectionName: 'case-trustee-appointments',
        operation: 'rename',
        matchChapter: '09',
        setChapter: '9',
      });
      expect(sentMessages).toContainEqual({
        collectionName: 'case-trustee-appointments',
        operation: 'delete',
        matchChapter: 'AC',
      });
      expect(sentMessages).toContainEqual({
        collectionName: 'trustee-case-appointments',
        operation: 'rename',
        matchChapter: '7A',
        setChapter: '7',
      });
      expect(sentMessages).toContainEqual({
        collectionName: 'trustee-case-appointments',
        operation: 'rename',
        matchChapter: '7N',
        setChapter: '7',
      });
      expect(sentMessages).toContainEqual({
        collectionName: 'trustee-case-appointments',
        operation: 'rename',
        matchChapter: '09',
        setChapter: '9',
      });
      expect(sentMessages).toContainEqual({
        collectionName: 'trustee-case-appointments',
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
      expect(outputs.length).toBeGreaterThan(0);
    });
  });

  describe('handleReader', () => {
    const baseMessage: ReaderMessage = {
      collectionName: 'case-trustee-appointments',
      operation: 'rename',
      matchChapter: '7A',
      setChapter: '7',
    };

    test('pages non-empty results to the writer queue and re-enqueues itself with a delay', async () => {
      const { handleReader } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(FixChapter7AppointmentsModule.default, 'readIds').mockResolvedValue([
        'id-1',
        'id-2',
        'id-3',
      ]);

      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
        sendMessage: mockSendMessage,
      } as unknown as StorageQueueHumbleObject);

      await handleReader(baseMessage, invocationContext);

      // At least one writer message page, plus the reader self re-enqueue.
      expect(mockSendMessage).toHaveBeenCalled();

      const writerCalls = mockSendMessage.mock.calls.filter((call) => {
        const parsed = JSON.parse(call[0] as string);
        return Array.isArray(parsed.ids);
      });
      expect(writerCalls.length).toBeGreaterThanOrEqual(1);
      const writerMessage: WriterMessage = JSON.parse(writerCalls[0][0] as string);
      expect(writerMessage.ids).toEqual(['id-1', 'id-2', 'id-3']);
      expect(writerMessage.collectionName).toBe('case-trustee-appointments');
      expect(writerMessage.operation).toBe('rename');
      expect(writerMessage.matchChapter).toBe('7A');
      expect(writerMessage.setChapter).toBe('7');

      // Reader re-enqueue: same shape as the original message, sent with a 30s delay.
      const reReaderCall = mockSendMessage.mock.calls.find((call) => {
        const parsed = JSON.parse(call[0] as string);
        return !('ids' in parsed);
      });
      expect(reReaderCall).toBeDefined();
      expect(reReaderCall![1]).toBe(30);
      expect(JSON.parse(reReaderCall![0] as string)).toEqual(baseMessage);
    });

    test('does NOT re-enqueue when readIds returns empty', async () => {
      const { handleReader } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(FixChapter7AppointmentsModule.default, 'readIds').mockResolvedValue([]);

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

    test('routes to DLQ when readIds throws unexpectedly', async () => {
      const { handleReader } = await import('./fix-chapter-7-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(FixChapter7AppointmentsModule.default, 'readIds').mockRejectedValue(
        new Error('mongo read failed'),
      );

      await handleReader(baseMessage, invocationContext);

      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      expect(outputs.length).toBeGreaterThan(0);
    });
  });

  describe('handleWriter', () => {
    const baseWriterMessage: WriterMessage = {
      collectionName: 'case-trustee-appointments',
      operation: 'rename',
      matchChapter: '7A',
      setChapter: '7',
      ids: ['id-1', 'id-2'],
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
        'case-trustee-appointments',
        ['id-1', 'id-2'],
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
