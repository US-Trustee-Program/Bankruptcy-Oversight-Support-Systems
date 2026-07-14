import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as StorageQueue from '@azure/storage-queue';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import type { MigrationStartMessage } from './migrate-trustees';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-invocation-id',
    functionName: 'migrate-trustees-handleStart',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

describe('migrate-trustees', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsStorage = 'UseDevelopmentStorage=true';

    const mockContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    vi.spyOn(DataflowTelemetry, 'completeDataflowTrace').mockReturnValue(undefined);
  });

  describe('handleStart — flushQueues', () => {
    test('dumps all queues to blobs when every queue exists', async () => {
      const { handleStart } = await import('./migrate-trustees');
      const invocationContext = makeInvocationContext();

      const mockReceiveMessages = vi.fn().mockResolvedValue({ receivedMessageItems: [] });
      vi.spyOn(StorageQueue.QueueServiceClient, 'fromConnectionString').mockReturnValue({
        getQueueClient: vi.fn().mockReturnValue({ receiveMessages: mockReceiveMessages }),
      } as unknown as StorageQueue.QueueServiceClient);

      const factoryModule = (await import('../../../lib/factory')).default;
      const writeObject = vi.fn();
      vi.spyOn(factoryModule, 'getObjectStorageGateway').mockReturnValue({
        writeObject,
        readObject: vi.fn(),
      });

      await handleStart({ flushQueues: true } as MigrationStartMessage, invocationContext);

      expect(mockReceiveMessages).toHaveBeenCalledTimes(4);
      expect(writeObject).not.toHaveBeenCalled();
      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      expect(outputs).toHaveLength(0);
    });

    test('treats a queue that does not exist (404) as empty instead of aborting the flush', async () => {
      // Regression test: DLQ and FAILED_APPOINTMENTS are only created lazily the first
      // time a message is enqueued to them. In production, neither queue had ever
      // received a message, so receiveMessages() threw "QueueNotFound" (404) on DLQ —
      // aborting handleStart before it ever reached FAILED_APPOINTMENTS, and causing
      // the flushQueues start message to be retried and poison-queued.
      const { handleStart } = await import('./migrate-trustees');
      const invocationContext = makeInvocationContext();

      const notFoundError = new StorageQueue.RestError('The specified queue does not exist.', {
        statusCode: 404,
      });

      const mockReceiveMessages = vi
        .fn()
        .mockResolvedValueOnce({ receivedMessageItems: [] }) // START
        .mockResolvedValueOnce({ receivedMessageItems: [] }) // PAGE
        .mockRejectedValueOnce(notFoundError) // DLQ — never created
        .mockRejectedValueOnce(notFoundError); // FAILED_APPOINTMENTS — never created

      vi.spyOn(StorageQueue.QueueServiceClient, 'fromConnectionString').mockReturnValue({
        getQueueClient: vi.fn().mockReturnValue({ receiveMessages: mockReceiveMessages }),
      } as unknown as StorageQueue.QueueServiceClient);

      const factoryModule = (await import('../../../lib/factory')).default;
      const writeObject = vi.fn();
      vi.spyOn(factoryModule, 'getObjectStorageGateway').mockReturnValue({
        writeObject,
        readObject: vi.fn(),
      });

      await expect(
        handleStart({ flushQueues: true } as MigrationStartMessage, invocationContext),
      ).resolves.toBeUndefined();

      expect(mockReceiveMessages).toHaveBeenCalledTimes(4);
      expect(writeObject).not.toHaveBeenCalled();
    });

    test('rethrows non-404 errors instead of swallowing them', async () => {
      const { handleStart } = await import('./migrate-trustees');
      const invocationContext = makeInvocationContext();

      const serverError = new StorageQueue.RestError('Internal server error.', {
        statusCode: 500,
      });

      const mockReceiveMessages = vi.fn().mockRejectedValueOnce(serverError);
      vi.spyOn(StorageQueue.QueueServiceClient, 'fromConnectionString').mockReturnValue({
        getQueueClient: vi.fn().mockReturnValue({ receiveMessages: mockReceiveMessages }),
      } as unknown as StorageQueue.QueueServiceClient);

      const factoryModule = (await import('../../../lib/factory')).default;
      vi.spyOn(factoryModule, 'getObjectStorageGateway').mockReturnValue({
        writeObject: vi.fn(),
        readObject: vi.fn(),
      });

      await expect(
        handleStart({ flushQueues: true } as MigrationStartMessage, invocationContext),
      ).rejects.toThrow('Internal server error.');
    });
  });
});
