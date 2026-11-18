import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import RunTrusteeDataReport from '../../../lib/use-cases/trustee-data-report/run-trustee-data-report';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import { buildQueueName } from '../dataflows-common';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { ApplicationContext } from '../../../lib/adapters/types/basic';
import { RATE_LIMIT_RETRY_LIMIT } from '../dataflows-rate-limit';
import { handlePage, handleStart } from './trustee-data-report';

const MODULE_NAME = 'TRUSTEE-DATA-REPORT';
const START_QUEUE_NAME = buildQueueName(MODULE_NAME, 'start');
const PAGE_QUEUE_NAME = buildQueueName(MODULE_NAME, 'page');
const DLQ_QUEUE_NAME = buildQueueName(MODULE_NAME, 'dlq');

function makeInvocationContext(): InvocationContext {
  return {
    invocationId: 'test-id',
    functionName: 'trustee-data-report',
    extraOutputs: new Map(),
    log: vi.fn(),
  } as unknown as InvocationContext;
}

/** The value an output binding was given, looked up by queue name. */
function outputFor(invocationContext: InvocationContext, queueName: string): unknown {
  const extraOutputs = invocationContext.extraOutputs as unknown as Map<
    { queueName: string },
    unknown
  >;
  for (const [binding, value] of extraOutputs) {
    if (binding.queueName === queueName) return value;
  }
  return undefined;
}

describe('trustee-data-report dataflow', () => {
  let appContext: ApplicationContext;
  let invocationContext: InvocationContext;
  let failRun: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
    invocationContext = makeInvocationContext();
    appContext = await createMockApplicationContext();
    // As in ApplicationContextCreator, the application context shares the invocation's outputs.
    appContext.extraOutputs = invocationContext.extraOutputs;
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(appContext);
    vi.spyOn(DataflowTelemetry, 'completeDataflowTrace').mockReturnValue(undefined);
    failRun = vi.spyOn(RunTrusteeDataReport, 'failRun').mockResolvedValue(undefined);
  });

  const outputs = (queueName: string) => outputFor(invocationContext, queueName);

  describe('handleStart', () => {
    test('should enqueue the first page when the run starts', async () => {
      vi.spyOn(RunTrusteeDataReport, 'startRun').mockResolvedValue('started');

      await handleStart({ runId: 'run-1' }, invocationContext);

      expect(outputs(PAGE_QUEUE_NAME)).toEqual({ runId: 'run-1', cursor: null });
    });

    test('should enqueue nothing when the start is skipped', async () => {
      vi.spyOn(RunTrusteeDataReport, 'startRun').mockResolvedValue('skipped');

      await handleStart({ runId: 'run-1' }, invocationContext);

      expect(outputs(PAGE_QUEUE_NAME)).toBeUndefined();
    });

    test('should fail the run and dead-letter the message on an unexpected error', async () => {
      vi.spyOn(RunTrusteeDataReport, 'startRun').mockRejectedValue(new Error('boom'));

      await handleStart({ runId: 'run-1' }, invocationContext);

      expect(failRun).toHaveBeenCalledWith(appContext, 'run-1', expect.stringContaining('boom'));
      expect(outputs(DLQ_QUEUE_NAME)).toBeDefined();
    });

    test('should requeue the start, not a page, when Cosmos throttles, without failing the run', async () => {
      vi.spyOn(RunTrusteeDataReport, 'startRun').mockRejectedValue(
        new TooManyRequestsError('TEST'),
      );
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      const queueClient = vi
        .spyOn(StorageQueueHumbleObject, 'fromConnectionString')
        .mockReturnValue({ sendMessage } as unknown as StorageQueueHumbleObject);

      await handleStart({ runId: 'run-1' }, invocationContext);

      expect(queueClient).toHaveBeenCalledWith(expect.any(String), START_QUEUE_NAME);
      expect(JSON.parse(sendMessage.mock.calls[0][0])).toEqual(
        expect.objectContaining({ runId: 'run-1', retryCount: 1 }),
      );
      expect(failRun).not.toHaveBeenCalled();
    });
  });

  describe('handlePage', () => {
    test('should enqueue the next page, keeping the runId', async () => {
      vi.spyOn(RunTrusteeDataReport, 'processPage').mockResolvedValue({ nextCursor: 200 });

      await handlePage({ runId: 'run-1', cursor: 100 }, invocationContext);

      expect(RunTrusteeDataReport.processPage).toHaveBeenCalledWith(appContext, 'run-1', 100);
      expect(outputs(PAGE_QUEUE_NAME)).toEqual({ runId: 'run-1', cursor: 200 });
    });

    test('should enqueue nothing once the run is finalized', async () => {
      vi.spyOn(RunTrusteeDataReport, 'processPage').mockResolvedValue({ nextCursor: null });

      await handlePage({ runId: 'run-1', cursor: 100 }, invocationContext);

      expect(outputs(PAGE_QUEUE_NAME)).toBeUndefined();
    });

    test('should requeue the same page with backoff when Cosmos throttles, without failing the run', async () => {
      vi.spyOn(RunTrusteeDataReport, 'processPage').mockRejectedValue(
        new TooManyRequestsError('TEST'),
      );
      const sendMessage = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockImplementation(
        (_connection: string, queueName: string) => {
          expect(queueName).toBe(PAGE_QUEUE_NAME);
          return { sendMessage } as unknown as StorageQueueHumbleObject;
        },
      );

      await handlePage({ runId: 'run-1', cursor: 100 }, invocationContext);

      expect(JSON.parse(sendMessage.mock.calls[0][0])).toEqual(
        expect.objectContaining({ runId: 'run-1', cursor: 100, retryCount: 1 }),
      );
      expect(failRun).not.toHaveBeenCalled();
    });

    test('should fail the run when throttling retries are exhausted', async () => {
      vi.spyOn(RunTrusteeDataReport, 'processPage').mockRejectedValue(
        new TooManyRequestsError('TEST'),
      );

      await handlePage(
        { runId: 'run-1', cursor: 100, retryCount: RATE_LIMIT_RETRY_LIMIT },
        invocationContext,
      );

      expect(failRun).toHaveBeenCalledWith(appContext, 'run-1', expect.any(String));
      // The retry helper's dead letter (with the original message) is kept, not overwritten.
      expect(outputs(DLQ_QUEUE_NAME)).toEqual([
        expect.objectContaining({
          message: expect.objectContaining({ runId: 'run-1', cursor: 100 }),
        }),
      ]);
    });

    test('should fail the run and dead-letter the message on an unexpected error', async () => {
      vi.spyOn(RunTrusteeDataReport, 'processPage').mockRejectedValue(new Error('TOD is down'));

      await handlePage({ runId: 'run-1', cursor: 100 }, invocationContext);

      expect(failRun).toHaveBeenCalledWith(
        appContext,
        'run-1',
        expect.stringContaining('TOD is down'),
      );
      expect(outputs(DLQ_QUEUE_NAME)).toEqual(
        expect.objectContaining({ type: 'QUEUE_ERROR', activityName: 'handlePage' }),
      );
    });

    test('should still dead-letter the message if marking the run failed also fails', async () => {
      vi.spyOn(RunTrusteeDataReport, 'processPage').mockRejectedValue(new Error('TOD is down'));
      failRun.mockRejectedValue(new Error('Cosmos is down too'));

      await handlePage({ runId: 'run-1', cursor: 100 }, invocationContext);

      expect(outputs(DLQ_QUEUE_NAME)).toBeDefined();
    });
  });
});
