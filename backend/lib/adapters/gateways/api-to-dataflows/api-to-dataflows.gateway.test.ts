import MockData from '@common/cams/test-utilities/mock-data';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  ApiToDataflowsGatewayImpl,
  __clearQueueClientCacheForTests,
} from './api-to-dataflows.gateway';
import { StorageQueueHumbleObject } from '../../../humble-objects/storage-queue-humble';
import {
  CASE_ASSIGNMENT_EVENT_QUEUE,
  SYNC_CASES_PAGE_QUEUE,
  TRUSTEE_CHANGE_NOTIFICATION_QUEUE,
  TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE,
} from '../../../storage-queues';
import {
  TrusteeChangeNotificationEvent,
  TrusteeVerificationRemapMessage,
} from '@common/cams/dataflow-events';

const buildTrusteeChangeNotificationEvent = (): TrusteeChangeNotificationEvent => ({
  changeSet: {
    trusteeId: 'trustee-123',
    trusteeName: 'Jane Trustee',
    fields: [
      {
        label: 'Name',
        comparisons: [{ before: 'A', after: 'B' }],
        category: 'profile',
        section: 'appointment',
      },
    ],
  },
});

describe('ApiToDataflowsGatewayImpl', () => {
  let mockSendMessage: ReturnType<typeof vi.fn>;
  let fromConnectionStringSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    // The gateway memoizes StorageQueueHumbleObject instances at module scope (keyed by
    // connection string + queue name) so queueEnsured persists across sends in production.
    // Clear that cache per test so each test's spy on fromConnectionString is consulted
    // fresh, instead of a prior test's cached client (and its mock) being reused.
    __clearQueueClientCacheForTests();
    process.env.AzureWebJobsDataflowsStorage = 'UseDevelopmentStorage=true';

    mockSendMessage = vi.fn().mockResolvedValue(undefined);
    fromConnectionStringSpy = vi
      .spyOn(StorageQueueHumbleObject, 'fromConnectionString')
      .mockReturnValue({ sendMessage: mockSendMessage } as unknown as StorageQueueHumbleObject);
  });

  describe('queueCaseReload', () => {
    test('sends the case-reload event wrapped in an array to the page queue', async () => {
      const gateway = new ApiToDataflowsGatewayImpl();
      const caseId = '081-12-34567';

      await gateway.queueCaseReload(caseId);

      expect(fromConnectionStringSpy).toHaveBeenCalledWith(
        'UseDevelopmentStorage=true',
        SYNC_CASES_PAGE_QUEUE.queueName,
      );
      expect(mockSendMessage).toHaveBeenCalledWith(
        JSON.stringify([{ caseId, type: 'CASE_CHANGED' }]),
      );
    });

    test('sends each case reload independently', async () => {
      const gateway = new ApiToDataflowsGatewayImpl();

      await gateway.queueCaseReload('081-12-34567');
      await gateway.queueCaseReload('087-99-79400');

      expect(mockSendMessage).toHaveBeenCalledTimes(2);
      expect(mockSendMessage).toHaveBeenNthCalledWith(
        1,
        JSON.stringify([{ caseId: '081-12-34567', type: 'CASE_CHANGED' }]),
      );
      expect(mockSendMessage).toHaveBeenNthCalledWith(
        2,
        JSON.stringify([{ caseId: '087-99-79400', type: 'CASE_CHANGED' }]),
      );
    });
  });

  describe('when AzureWebJobsDataflowsStorage is not configured', () => {
    test('throws instead of silently no-opping (e.g. misconfiguration or a partial deploy)', async () => {
      delete process.env.AzureWebJobsDataflowsStorage;
      const gateway = new ApiToDataflowsGatewayImpl();

      await expect(gateway.queueCaseReload('081-12-34567')).rejects.toThrow(
        'Missing required environment variable: AzureWebJobsDataflowsStorage',
      );
      expect(fromConnectionStringSpy).not.toHaveBeenCalled();
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('queueCaseAssignmentEvent', () => {
    test('sends the case assignment event as-is to the case-assignment queue', async () => {
      const gateway = new ApiToDataflowsGatewayImpl();
      const event = MockData.getAttorneyAssignment();

      await gateway.queueCaseAssignmentEvent(event);

      expect(fromConnectionStringSpy).toHaveBeenCalledWith(
        'UseDevelopmentStorage=true',
        CASE_ASSIGNMENT_EVENT_QUEUE.queueName,
      );
      expect(mockSendMessage).toHaveBeenCalledWith(JSON.stringify(event));
    });
  });

  describe('queueTrusteeVerificationRemap', () => {
    test('sends the remap message as-is to the trustee-match-verification-remap queue', async () => {
      const gateway = new ApiToDataflowsGatewayImpl();
      const message: TrusteeVerificationRemapMessage = {
        fingerprint: 'fp-abc123',
        resolvedTrusteeId: 'trustee-123',
        resolvedTrusteeName: 'New Trustee',
        verificationId: 'verification-1',
      };

      await gateway.queueTrusteeVerificationRemap(message);

      expect(fromConnectionStringSpy).toHaveBeenCalledWith(
        'UseDevelopmentStorage=true',
        TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE.queueName,
      );
      expect(mockSendMessage).toHaveBeenCalledWith(JSON.stringify(message));
    });
  });

  describe('queueTrusteeChangeNotification', () => {
    test('sends the trustee change notification event as-is to the trustee-change-notification queue', async () => {
      const gateway = new ApiToDataflowsGatewayImpl();
      const event = buildTrusteeChangeNotificationEvent();

      await gateway.queueTrusteeChangeNotification(event);

      expect(fromConnectionStringSpy).toHaveBeenCalledWith(
        'UseDevelopmentStorage=true',
        TRUSTEE_CHANGE_NOTIFICATION_QUEUE.queueName,
      );
      expect(mockSendMessage).toHaveBeenCalledWith(JSON.stringify(event));
    });
  });

  // Shared behavior across all four queue methods: each delegates to the private enqueue(),
  // so a send failure must propagate the same way regardless of which public method was called.
  describe('when the underlying send fails', () => {
    test.each([
      [
        'queueCaseAssignmentEvent',
        (gateway: ApiToDataflowsGatewayImpl) =>
          gateway.queueCaseAssignmentEvent(MockData.getAttorneyAssignment()),
      ],
      [
        'queueTrusteeVerificationRemap',
        (gateway: ApiToDataflowsGatewayImpl) =>
          gateway.queueTrusteeVerificationRemap({
            fingerprint: 'fp-abc123',
            resolvedTrusteeId: 'trustee-123',
            verificationId: 'verification-1',
          }),
      ],
      [
        'queueCaseReload',
        (gateway: ApiToDataflowsGatewayImpl) => gateway.queueCaseReload('081-12-34567'),
      ],
      [
        'queueTrusteeChangeNotification',
        (gateway: ApiToDataflowsGatewayImpl) =>
          gateway.queueTrusteeChangeNotification(buildTrusteeChangeNotificationEvent()),
      ],
    ])(
      '%s propagates a send failure instead of silently dropping the message',
      async (_name, invoke) => {
        mockSendMessage.mockRejectedValueOnce(new Error('queue unavailable'));
        const gateway = new ApiToDataflowsGatewayImpl();

        await expect(invoke(gateway)).rejects.toThrow('queue unavailable');
      },
    );
  });
});
