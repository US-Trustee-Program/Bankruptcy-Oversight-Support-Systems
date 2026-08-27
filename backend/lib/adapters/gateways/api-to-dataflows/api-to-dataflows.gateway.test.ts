import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ApiToDataflowsGatewayImpl } from './api-to-dataflows.gateway';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { StorageQueueHumbleObject } from '../../../humble-objects/storage-queue-humble';
import {
  CASE_ASSIGNMENT_EVENT_QUEUE,
  SYNC_CASES_PAGE_QUEUE,
  TRUSTEE_APPOINTMENT_EVENT_QUEUE,
  TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE,
} from '../../../storage-queues';
import {
  CaseAssignmentDownstreamEvent,
  TrusteeAppointmentDownstreamEvent,
  TrusteeVerificationRemapMessage,
} from '@common/cams/dataflow-events';

describe('ApiToDataflowsGatewayImpl', () => {
  let mockContext: ApplicationContext;
  let mockSendMessage: ReturnType<typeof vi.fn>;
  let fromConnectionStringSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    mockContext = await createMockApplicationContext();
    process.env.AzureWebJobsDataflowsStorage = 'UseDevelopmentStorage=true';

    mockSendMessage = vi.fn().mockResolvedValue(undefined);
    fromConnectionStringSpy = vi
      .spyOn(StorageQueueHumbleObject, 'fromConnectionString')
      .mockReturnValue({ sendMessage: mockSendMessage } as unknown as StorageQueueHumbleObject);
  });

  describe('queueCaseReload', () => {
    test('sends the case-reload event wrapped in an array to the page queue', async () => {
      const gateway = new ApiToDataflowsGatewayImpl(mockContext);
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
      const gateway = new ApiToDataflowsGatewayImpl(mockContext);

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
      const gateway = new ApiToDataflowsGatewayImpl(mockContext);

      await expect(gateway.queueCaseReload('081-12-34567')).rejects.toThrow(
        'Missing required environment variable: AzureWebJobsDataflowsStorage',
      );
      expect(fromConnectionStringSpy).not.toHaveBeenCalled();
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('queueCaseAssignmentEvent', () => {
    test('sends the case assignment event as-is to the case-assignment queue', async () => {
      const gateway = new ApiToDataflowsGatewayImpl(mockContext);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eventData: any = {
        caseId: '081-12-34567',
        userId: 'user123',
        name: 'Test User',
        role: 'TrialAttorney',
        assignedOn: '2024-01-01',
      };
      const event: CaseAssignmentDownstreamEvent = { ...eventData, acmsProfessionalId: null };

      await gateway.queueCaseAssignmentEvent(event);

      expect(fromConnectionStringSpy).toHaveBeenCalledWith(
        'UseDevelopmentStorage=true',
        CASE_ASSIGNMENT_EVENT_QUEUE.queueName,
      );
      expect(mockSendMessage).toHaveBeenCalledWith(JSON.stringify(event));
    });

    test('propagates a send failure instead of silently dropping the message', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('queue unavailable'));
      const gateway = new ApiToDataflowsGatewayImpl(mockContext);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eventData: any = {
        caseId: '081-12-34567',
        userId: 'user123',
        name: 'Test User',
        role: 'TrialAttorney',
        assignedOn: '2024-01-01',
      };
      const event: CaseAssignmentDownstreamEvent = { ...eventData, acmsProfessionalId: null };

      await expect(gateway.queueCaseAssignmentEvent(event)).rejects.toThrow('queue unavailable');
    });
  });

  describe('queueTrusteeAppointmentEvent', () => {
    test('sends the trustee appointment event as-is to the trustee-appointment-event queue', async () => {
      const gateway = new ApiToDataflowsGatewayImpl(mockContext);
      const event: TrusteeAppointmentDownstreamEvent = {
        caseId: '081-12-34567',
        trusteeId: 'trustee-123',
        acmsProfessionalId: 'NY-00063',
        assignedOn: '2024-01-01T00:00:00.000Z',
        appointedDate: '2024-01-01',
        chapter: '7',
      };

      await gateway.queueTrusteeAppointmentEvent(event);

      expect(fromConnectionStringSpy).toHaveBeenCalledWith(
        'UseDevelopmentStorage=true',
        TRUSTEE_APPOINTMENT_EVENT_QUEUE.queueName,
      );
      expect(mockSendMessage).toHaveBeenCalledWith(JSON.stringify(event));
    });

    test('propagates a send failure instead of silently dropping the message', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('queue unavailable'));
      const gateway = new ApiToDataflowsGatewayImpl(mockContext);
      const event: TrusteeAppointmentDownstreamEvent = {
        caseId: '081-12-34567',
        trusteeId: 'trustee-123',
        acmsProfessionalId: 'NY-00063',
        assignedOn: '2024-01-01T00:00:00.000Z',
        appointedDate: '2024-01-01',
        chapter: '7',
      };

      await expect(gateway.queueTrusteeAppointmentEvent(event)).rejects.toThrow(
        'queue unavailable',
      );
    });
  });

  describe('queueTrusteeVerificationRemap', () => {
    test('sends the remap message as-is to the trustee-match-verification-remap queue', async () => {
      const gateway = new ApiToDataflowsGatewayImpl(mockContext);
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

    test('propagates a send failure instead of silently dropping the message', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('queue unavailable'));
      const gateway = new ApiToDataflowsGatewayImpl(mockContext);

      await expect(
        gateway.queueTrusteeVerificationRemap({
          fingerprint: 'fp-abc123',
          resolvedTrusteeId: 'trustee-123',
          verificationId: 'verification-1',
        }),
      ).rejects.toThrow('queue unavailable');
    });
  });
});
