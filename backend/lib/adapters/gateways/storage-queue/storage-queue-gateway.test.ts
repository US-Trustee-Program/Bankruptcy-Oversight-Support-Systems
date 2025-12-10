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

      expect(extraOutputs.set).toHaveBeenCalledWith(expect.anything(), [{}, {}]);
    });
  });
});
