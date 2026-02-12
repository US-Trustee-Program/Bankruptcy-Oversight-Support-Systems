import { vi } from 'vitest';
import { InvocationContextExtraOutputs } from '@azure/functions';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import StorageQueueGateway from './storage-queue-gateway';

describe('storage queue gateway', () => {
  describe('using', () => {
    const { using } = StorageQueueGateway;

    test('should return an enqueue function to queue messages', async () => {
      const extraOutputs: InvocationContextExtraOutputs = {
        set: vi.fn(),
        get: vi.fn(),
      };

      const context = await createMockApplicationContext();
      context.extraOutputs = extraOutputs;
      const actual = using(context, 'CASE_ASSIGNMENT_EVENT');

      expect('enqueue' in actual).toBeTruthy();
      expect(typeof actual.enqueue === 'function').toBeTruthy();

      actual.enqueue({}, {});

      expect(extraOutputs.set).toHaveBeenCalledWith(
        expect.objectContaining({
          queueName: 'case-assignment-event',
          type: 'queue',
        }),
        [[{}, {}]],
      );
    });

    test('should support SYNC_CASES_PAGE queue for case reload', async () => {
      const extraOutputs: InvocationContextExtraOutputs = {
        set: vi.fn(),
        get: vi.fn(),
      };

      const context = await createMockApplicationContext();
      context.extraOutputs = extraOutputs;
      const actual = using(context, 'SYNC_CASES_PAGE');

      expect('enqueue' in actual).toBeTruthy();
      expect(typeof actual.enqueue === 'function').toBeTruthy();

      const testEvent = { type: 'CASE_CHANGED', caseId: '081-12-34567' };
      actual.enqueue(testEvent);

      expect(extraOutputs.set).toHaveBeenCalledWith(
        expect.objectContaining({
          queueName: 'sync-cases-page',
          type: 'queue',
        }),
        [[testEvent]],
      );
    });
  });
});
