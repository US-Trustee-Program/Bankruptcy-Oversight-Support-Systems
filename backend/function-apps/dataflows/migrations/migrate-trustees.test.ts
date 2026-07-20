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
    // flushQueues is a failure/DLQ/unmatched inspection tool: it drains exactly
    // four queues — DLQ, failed-appointments, unmatched-professional-ids, and
    // heal-unmatched-professional-ids. The transient START and PAGE work queues
    // are deliberately excluded, and the heal-page continuation queue is never
    // flushed.
    test('dumps the failure/unmatched queues to blobs when every queue exists', async () => {
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

      // Flush order: DLQ (empty); FAILED_APPOINTMENTS (two messages across two
      // pages); UNMATCHED_PROFESSIONAL_IDS (empty); HEAL_UNMATCHED (empty).
      const mockReceiveMessages = vi
        .fn()
        .mockResolvedValueOnce({ receivedMessageItems: [] }) // DLQ
        .mockResolvedValueOnce({ receivedMessageItems: [toQueueItem(message1, 'msg-1')] }) // FAILED_APPOINTMENTS page 1
        .mockResolvedValueOnce({ receivedMessageItems: [toQueueItem(message2, 'msg-2')] }) // FAILED_APPOINTMENTS page 2
        .mockResolvedValueOnce({ receivedMessageItems: [] }) // FAILED_APPOINTMENTS drained
        .mockResolvedValueOnce({ receivedMessageItems: [] }) // UNMATCHED_PROFESSIONAL_IDS
        .mockResolvedValueOnce({ receivedMessageItems: [] }); // HEAL_UNMATCHED_PROFESSIONAL_IDS

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

    test('does not flush the START or PAGE work queues', async () => {
      // Regression guard for the cams-zxws trim: flushQueues must never drain the
      // transient start/page work queues. We drain 4 queues, none of which are
      // start/page — asserting the count is the simplest proxy since queue names
      // aren't surfaced through the mock.
      const { handleStart } = await import('./migrate-trustees');
      const invocationContext = makeInvocationContext();

      const getQueueClient = vi.fn().mockReturnValue({
        receiveMessages: vi.fn().mockResolvedValue({ receivedMessageItems: [] }),
        deleteMessage: vi.fn(),
      });
      vi.spyOn(StorageQueue.QueueServiceClient, 'fromConnectionString').mockReturnValue({
        getQueueClient,
      } as unknown as StorageQueue.QueueServiceClient);
      const factoryModule = (await import('../../../lib/factory')).default;
      vi.spyOn(factoryModule, 'getObjectStorageGateway').mockReturnValue({
        writeObject: vi.fn(),
        readObject: vi.fn(),
      });

      await handleStart({ flushQueues: true } as MigrationStartMessage, invocationContext);

      const flushedQueueNames = getQueueClient.mock.calls.map((call) => call[0]);
      expect(flushedQueueNames).toHaveLength(4);
      expect(flushedQueueNames).not.toContain('migrate-trustees-start');
      expect(flushedQueueNames).not.toContain('migrate-trustees-page');
      expect(flushedQueueNames).not.toContain('migrate-trustees-heal-page');
      expect(flushedQueueNames).toContain('migrate-trustees-heal-unmatched-professional-ids');
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
        .mockRejectedValueOnce(notFoundError) // DLQ — never created
        .mockRejectedValueOnce(notFoundError) // FAILED_APPOINTMENTS — never created
        .mockRejectedValueOnce(notFoundError) // UNMATCHED_PROFESSIONAL_IDS — never created
        .mockRejectedValueOnce(notFoundError); // HEAL_UNMATCHED_PROFESSIONAL_IDS — never created

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

  describe('handleStart — heal (reader)', () => {
    const acmsRecord = (id: string) => ({
      acmsProfessionalId: id,
      firstName: 'First',
      lastName: 'Last',
      state: 'NY',
    });

    async function spyReader(result: unknown) {
      const useCaseModule = await import('../../../lib/use-cases/dataflows/migrate-trustees');
      return vi
        .spyOn(useCaseModule.default.prototype, 'readAllTrusteeProfessionalRecords')
        .mockResolvedValue(result as never);
    }

    async function spyInitHealState(result: unknown = { data: undefined }) {
      const stateModule =
        await import('../../../lib/use-cases/dataflows/trustee-migration-state.service');
      return vi.spyOn(stateModule, 'initHealState').mockResolvedValue(result as never);
    }

    test('chunks the ACMS record set into heal-page messages and initializes heal state', async () => {
      const { handleStart } = await import('./migrate-trustees');
      const invocationContext = makeInvocationContext();

      // 250 records with HEAL_PAGE_SIZE=100 → 3 pages (100, 100, 50).
      const records = Array.from({ length: 250 }, (_, i) => acmsRecord(`NY-${i}`));
      await spyReader({ data: records });
      const initSpy = await spyInitHealState();
      const traceSpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

      await handleStart({ heal: true } as MigrationStartMessage, invocationContext);

      expect(initSpy).toHaveBeenCalledWith(expect.anything(), { scanned: 250, pagesTotal: 3 });

      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      expect(outputs).toHaveLength(1);
      const pageMessages = outputs[0] as Array<{ records: unknown[] }>;
      expect(pageMessages).toHaveLength(3);
      expect(pageMessages[0].records).toHaveLength(100);
      expect(pageMessages[2].records).toHaveLength(50);

      expect(traceSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'handleStart',
        expect.anything(),
        expect.objectContaining({
          success: true,
          details: expect.objectContaining({
            mode: 'heal-read',
            scanned: '250',
            pagesEnqueued: '3',
          }),
        }),
      );
    });

    test('initializes heal state but enqueues no pages when ACMS has no records', async () => {
      const { handleStart } = await import('./migrate-trustees');
      const invocationContext = makeInvocationContext();

      await spyReader({ data: [] });
      const initSpy = await spyInitHealState();

      await handleStart({ heal: true } as MigrationStartMessage, invocationContext);

      expect(initSpy).toHaveBeenCalledWith(expect.anything(), { scanned: 0, pagesTotal: 0 });
      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      expect(outputs).toHaveLength(0);
    });

    test('routes reader failure to the DLQ and does not initialize heal state', async () => {
      const { handleStart } = await import('./migrate-trustees');
      const invocationContext = makeInvocationContext();

      await spyReader({ error: { message: 'ACMS unavailable' } });
      const initSpy = await spyInitHealState();
      const traceSpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

      await handleStart({ heal: true } as MigrationStartMessage, invocationContext);

      expect(initSpy).not.toHaveBeenCalled();
      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      expect(outputs).toHaveLength(1);
      expect(JSON.stringify(outputs[0])).toContain('ACMS unavailable');
      expect(traceSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'handleStart',
        expect.anything(),
        expect.objectContaining({ success: false, error: 'ACMS unavailable' }),
      );
    });

    test('routes heal-state init failure to the DLQ', async () => {
      const { handleStart } = await import('./migrate-trustees');
      const invocationContext = makeInvocationContext();

      await spyReader({ data: [acmsRecord('NY-1')] });
      await spyInitHealState({ error: { message: 'state write failed' } });

      await handleStart({ heal: true } as MigrationStartMessage, invocationContext);

      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      expect(outputs).toHaveLength(1);
      expect(JSON.stringify(outputs[0])).toContain('state write failed');
    });
  });

  describe('handleHealPage', () => {
    const acmsRecord = (id: string) => ({
      acmsProfessionalId: id,
      firstName: 'First',
      lastName: 'Last',
      state: 'NY',
    });

    async function spyPage(result: unknown) {
      const useCaseModule = await import('../../../lib/use-cases/dataflows/migrate-trustees');
      return vi
        .spyOn(useCaseModule.default.prototype, 'backfillProfessionalIdsPage')
        .mockResolvedValue(result as never);
    }

    async function spyRecordHealPageResult(result: unknown = { data: 5 }) {
      const stateModule =
        await import('../../../lib/use-cases/dataflows/trustee-migration-state.service');
      return vi.spyOn(stateModule, 'recordHealPageResult').mockResolvedValue(result as never);
    }

    test('records progress and does not route unmatched when a page fully matches', async () => {
      const { handleHealPage } = await import('./migrate-trustees');
      const invocationContext = makeInvocationContext();

      await spyPage({
        data: {
          created: 3,
          alreadyMapped: 1,
          unmatched: [],
          remaining: [],
          recommendedVisibilitySeconds: 0,
        },
      });
      const recordSpy = await spyRecordHealPageResult();
      const traceSpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

      await handleHealPage({ records: [acmsRecord('NY-1')] }, invocationContext);

      expect(recordSpy).toHaveBeenCalledWith(expect.anything(), {
        created: 3,
        alreadyMapped: 1,
        unmatched: 0,
      });
      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      expect(outputs).toHaveLength(0);
      expect(traceSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'handleHealPage',
        expect.anything(),
        expect.objectContaining({
          success: true,
          documentsWritten: 3,
          documentsFailed: 0,
          details: expect.objectContaining({ mode: 'heal-page' }),
        }),
      );
    });

    test('routes unmatched records to the heal-unmatched-professional-ids queue', async () => {
      const { handleHealPage } = await import('./migrate-trustees');
      const invocationContext = makeInvocationContext();

      await spyPage({
        data: {
          created: 0,
          alreadyMapped: 0,
          unmatched: [
            {
              acmsProfessionalId: 'NY-00063',
              firstName: 'Harvey',
              lastName: 'Barr',
              state: 'NY',
              reason: 'NO_TRUSTEE_MATCH',
            },
          ],
          remaining: [],
          recommendedVisibilitySeconds: 0,
        },
      });
      await spyRecordHealPageResult();

      await handleHealPage({ records: [acmsRecord('NY-00063')] }, invocationContext);

      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      expect(outputs).toHaveLength(1);
      expect(outputs[0]).toEqual([
        {
          type: 'UNMATCHED_PROFESSIONAL_ID',
          acmsProfessionalId: 'NY-00063',
          firstName: 'Harvey',
          lastName: 'Barr',
          state: 'NY',
          reason: 'NO_TRUSTEE_MATCH',
        },
      ]);
    });

    test('re-enqueues escape-hatch-deferred records to heal-page with a visibility delay', async () => {
      const { handleHealPage } = await import('./migrate-trustees');
      const invocationContext = makeInvocationContext();

      const remaining = [acmsRecord('NY-2'), acmsRecord('NY-3')];
      await spyPage({
        data: {
          created: 1,
          alreadyMapped: 0,
          unmatched: [],
          remaining,
          recommendedVisibilitySeconds: 120,
        },
      });
      await spyRecordHealPageResult();

      const sendMessage = vi.fn().mockResolvedValue(undefined);
      const { StorageQueueHumbleObject } =
        await import('../../../lib/humble-objects/storage-queue-humble');
      vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
        sendMessage,
      } as unknown as StorageQueue.QueueClient as never);

      await handleHealPage({ records: [acmsRecord('NY-1'), ...remaining] }, invocationContext);

      expect(sendMessage).toHaveBeenCalledTimes(1);
      const [payload, visibilityTimeout] = sendMessage.mock.calls[0];
      expect(JSON.parse(payload).records).toHaveLength(2);
      // recommended 120s + up to 30s jitter.
      expect(visibilityTimeout).toBeGreaterThanOrEqual(120);
    });

    test('routes escape-hatch records to the unmatched queue and counts them when re-enqueue fails', async () => {
      const { handleHealPage } = await import('./migrate-trustees');
      const invocationContext = makeInvocationContext();

      const remaining = [acmsRecord('NY-2'), acmsRecord('NY-3')];
      await spyPage({
        data: {
          created: 1,
          alreadyMapped: 0,
          unmatched: [],
          remaining,
          recommendedVisibilitySeconds: 120,
        },
      });
      const recordSpy = await spyRecordHealPageResult();

      const sendMessage = vi.fn().mockRejectedValue(new Error('storage throttled'));
      const { StorageQueueHumbleObject } =
        await import('../../../lib/humble-objects/storage-queue-humble');
      vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
        sendMessage,
      } as unknown as StorageQueue.QueueClient as never);

      await handleHealPage({ records: [acmsRecord('NY-1'), ...remaining] }, invocationContext);

      // Deferred records that could not be re-enqueued are routed to the
      // unmatched queue with REENQUEUE_FAILED rather than silently dropped.
      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      expect(outputs).toHaveLength(1);
      expect(outputs[0]).toEqual([
        {
          type: 'UNMATCHED_PROFESSIONAL_ID',
          acmsProfessionalId: 'NY-2',
          firstName: 'First',
          lastName: 'Last',
          state: 'NY',
          reason: 'REENQUEUE_FAILED',
        },
        {
          type: 'UNMATCHED_PROFESSIONAL_ID',
          acmsProfessionalId: 'NY-3',
          firstName: 'First',
          lastName: 'Last',
          state: 'NY',
          reason: 'REENQUEUE_FAILED',
        },
      ]);
      // They are counted so healRecordsRemaining still converges to 0.
      expect(recordSpy).toHaveBeenCalledWith(expect.anything(), {
        created: 1,
        alreadyMapped: 0,
        unmatched: 2,
      });
    });

    test('routes a page-processing failure to the DLQ', async () => {
      const { handleHealPage } = await import('./migrate-trustees');
      const invocationContext = makeInvocationContext();

      await spyPage({ error: { message: 'page write failed' } });
      const recordSpy = await spyRecordHealPageResult();

      await handleHealPage({ records: [acmsRecord('NY-1')] }, invocationContext);

      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      expect(outputs).toHaveLength(1);
      expect(JSON.stringify(outputs[0])).toContain('page write failed');
      expect(recordSpy).not.toHaveBeenCalled();
    });
  });
});
