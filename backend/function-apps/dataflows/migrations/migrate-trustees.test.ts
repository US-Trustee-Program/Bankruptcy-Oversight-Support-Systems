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

// Wires up the QueueServiceClient and object storage gateway mocks shared by every
// flushQueues test. `receiveMessages` is the only behavior that varies per test.
function setUpQueueAndStorageMocks(receiveMessages: ReturnType<typeof vi.fn>) {
  const deleteMessage = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(StorageQueue.QueueServiceClient, 'fromConnectionString').mockReturnValue({
    getQueueClient: vi.fn().mockReturnValue({ receiveMessages, deleteMessage }),
  } as unknown as StorageQueue.QueueServiceClient);

  const writeObject = vi.fn();
  return {
    deleteMessage,
    writeObject,
    setupFactory: async () => {
      const factoryModule = (await import('../../../lib/factory')).default;
      vi.spyOn(factoryModule, 'getObjectStorageGateway').mockReturnValue({
        writeObject,
        readObject: vi.fn(),
      });
    },
  };
}

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
      const { writeObject, setupFactory } = setUpQueueAndStorageMocks(mockReceiveMessages);
      await setupFactory();

      await handleStart({ flushQueues: true } as MigrationStartMessage, invocationContext);

      expect(mockReceiveMessages).toHaveBeenCalledTimes(4);
      expect(writeObject).not.toHaveBeenCalled();
      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      expect(outputs).toHaveLength(0);
    });

    test('drains queued messages, deletes them, and writes decoded JSONL to blob storage', async () => {
      const { handleStart } = await import('./migrate-trustees');
      const invocationContext = makeInvocationContext();

      const message1 = { type: 'FAILED_APPOINTMENT', trusteeId: '111' };
      const message2 = { type: 'FAILED_APPOINTMENT', trusteeId: '222' };
      const toQueueItem = (payload: unknown, messageId: string) => ({
        messageId,
        popReceipt: `pop-${messageId}`,
        messageText: Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64'),
      });

      // START and PAGE are empty; FAILED_APPOINTMENTS has two messages across two pages;
      // DLQ is empty.
      const mockReceiveMessages = vi
        .fn()
        .mockResolvedValueOnce({ receivedMessageItems: [] }) // START
        .mockResolvedValueOnce({ receivedMessageItems: [] }) // PAGE
        .mockResolvedValueOnce({ receivedMessageItems: [] }) // DLQ
        .mockResolvedValueOnce({ receivedMessageItems: [toQueueItem(message1, 'msg-1')] }) // FAILED_APPOINTMENTS page 1
        .mockResolvedValueOnce({ receivedMessageItems: [toQueueItem(message2, 'msg-2')] }) // FAILED_APPOINTMENTS page 2
        .mockResolvedValueOnce({ receivedMessageItems: [] }); // FAILED_APPOINTMENTS drained

      const { deleteMessage, writeObject, setupFactory } =
        setUpQueueAndStorageMocks(mockReceiveMessages);
      await setupFactory();

      await handleStart({ flushQueues: true } as MigrationStartMessage, invocationContext);

      expect(deleteMessage).toHaveBeenCalledTimes(2);
      expect(deleteMessage).toHaveBeenCalledWith('msg-1', 'pop-msg-1');
      expect(deleteMessage).toHaveBeenCalledWith('msg-2', 'pop-msg-2');

      expect(writeObject).toHaveBeenCalledTimes(1);
      const [containerName, blobName, content] = writeObject.mock.calls[0];
      expect(containerName).toBe('migrate-trustees-out');
      expect(blobName).toMatch(/^flush-failed-appointments-.*\.jsonl$/);
      expect(content).toBe(`${JSON.stringify(message1)}\n${JSON.stringify(message2)}`);
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

      const { writeObject, setupFactory } = setUpQueueAndStorageMocks(mockReceiveMessages);
      await setupFactory();

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
      const { setupFactory } = setUpQueueAndStorageMocks(mockReceiveMessages);
      await setupFactory();

      await expect(
        handleStart({ flushQueues: true } as MigrationStartMessage, invocationContext),
      ).rejects.toThrow('Internal server error.');
    });
  });
});
