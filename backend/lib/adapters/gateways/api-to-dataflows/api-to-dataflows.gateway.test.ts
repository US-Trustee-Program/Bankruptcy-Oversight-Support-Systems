import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ApiToDataflowsGatewayImpl } from './api-to-dataflows.gateway';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { InvocationContextExtraOutputs } from '@azure/functions';
import { CASE_ASSIGNMENT_EVENT_QUEUE, SYNC_CASES_PAGE_QUEUE } from '../../../storage-queues';
import { CaseAssignmentEvent } from '@common/cams/dataflow-events';

describe('ApiToDataflowsGatewayImpl', () => {
  let mockContext: ApplicationContext;
  let mockExtraOutputs: InvocationContextExtraOutputs;
  let setSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    mockContext = await createMockApplicationContext();

    setSpy = vi.fn();
    mockExtraOutputs = {
      set: setSpy,
    } as unknown as InvocationContextExtraOutputs;

    mockContext.extraOutputs = mockExtraOutputs;
  });

  describe('queueCaseReload', () => {
    test('should wrap single case reload event in an array when queuing to page queue', async () => {
      const gateway = new ApiToDataflowsGatewayImpl(mockContext);
      const caseId = '081-12-34567';

      await gateway.queueCaseReload(caseId);

      // Verify that extraOutputs.set receives the message wrapped in an array
      // The enqueue method wraps all messages: output.set(queue, [message])
      // Azure Functions unwraps one level, so [message] becomes message in the queue
      expect(setSpy).toHaveBeenCalledWith(SYNC_CASES_PAGE_QUEUE, [
        [{ caseId, type: 'CASE_CHANGED' }],
      ]);
    });

    test('should handle multiple case reloads independently', async () => {
      const gateway = new ApiToDataflowsGatewayImpl(mockContext);
      const caseId1 = '081-12-34567';
      const caseId2 = '087-99-79400';

      await gateway.queueCaseReload(caseId1);
      await gateway.queueCaseReload(caseId2);

      expect(setSpy).toHaveBeenCalledTimes(2);
      expect(setSpy).toHaveBeenNthCalledWith(1, SYNC_CASES_PAGE_QUEUE, [
        [{ caseId: caseId1, type: 'CASE_CHANGED' }],
      ]);
      expect(setSpy).toHaveBeenNthCalledWith(2, SYNC_CASES_PAGE_QUEUE, [
        [{ caseId: caseId2, type: 'CASE_CHANGED' }],
      ]);
    });

    test('should log warning when extraOutputs is unavailable', async () => {
      mockContext.extraOutputs = undefined;
      const warnSpy = vi.spyOn(mockContext.logger, 'warn');
      const gateway = new ApiToDataflowsGatewayImpl(mockContext);

      await gateway.queueCaseReload('081-12-34567');

      expect(warnSpy).toHaveBeenCalledWith(
        'API-TO-DATAFLOWS-GATEWAY',
        expect.stringContaining('Cannot enqueue to sync-cases-page'),
      );
      expect(setSpy).not.toHaveBeenCalled();
    });
  });

  describe('queueCaseAssignmentEvent', () => {
    test('should queue case assignment event wrapped for Azure Functions', async () => {
      const gateway = new ApiToDataflowsGatewayImpl(mockContext);
      const event: CaseAssignmentEvent = {
        caseId: '081-12-34567',
        userId: 'user123',
        name: 'Test User',
        role: 'TrialAttorney',
        assignedOn: '2024-01-01',
      };

      await gateway.queueCaseAssignmentEvent(event);

      // The enqueue method wraps the event: output.set(queue, [event])
      // Azure Functions unwraps one level, so the queue receives the event as-is
      expect(setSpy).toHaveBeenCalledWith(CASE_ASSIGNMENT_EVENT_QUEUE, [event]);
    });
  });
});
