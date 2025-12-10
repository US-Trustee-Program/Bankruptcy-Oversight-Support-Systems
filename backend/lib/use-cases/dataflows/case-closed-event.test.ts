import { vi } from 'vitest';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import CaseClosedEventUseCase from './case-closed-event';

describe('case closed event use case', () => {
  describe('handleCaseClosedEvent', () => {
    const event = { caseId: '000-11-22222' };
    const deleteMany = vi.spyOn(MockMongoRepository.prototype, 'deleteMany');
    const { handleCaseClosedEvent } = CaseClosedEventUseCase;

    test('should proxy a message to pass caseId to deleteCaseAssignment', async () => {
      deleteMany.mockResolvedValue();
      const context = await createMockApplicationContext();
      await handleCaseClosedEvent(context, event);
      expect(deleteMany).toHaveBeenCalledWith(event);
    });

    test('should throw errors', async () => {
      deleteMany.mockRejectedValue(new Error());
      const context = await createMockApplicationContext();
      await expect(handleCaseClosedEvent(context, event)).rejects.toThrow();
    });
  });
});
