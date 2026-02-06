import { vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { TrusteeAssistantsUseCase } from './trustee-assistants';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { TrusteeAssistantInput } from '@common/cams/trustee-assistants';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { UnknownError } from '../../common-errors/unknown-error';

const MODULE_NAME = 'TRUSTEE-ASSISTANTS-USE-CASE';

describe('TrusteeAssistantsUseCase', () => {
  describe('createAssistant', () => {
    const trusteeId = 'trustee-123';
    const mockTrustee = {
      id: trusteeId,
      name: 'John Doe',
      trusteeId: '123',
      public: {},
      updatedBy: SYSTEM_USER_REFERENCE,
      updatedOn: '2024-01-01T00:00:00Z',
    };

    const validInput: TrusteeAssistantInput = {
      name: 'Jane Assistant',
      title: 'Senior Legal Assistant',
      contact: {
        address: {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
        phone: {
          number: '555-123-4567',
        },
        email: 'jane@example.com',
      },
    };

    const createdAssistant = {
      id: 'assistant-123',
      trusteeId,
      ...validInput,
      updatedBy: SYSTEM_USER_REFERENCE,
      updatedOn: '2024-01-01T00:00:00Z',
    };

    test('should create an assistant with valid input', async () => {
      const mockContext = await createMockApplicationContext();

      // Mock trustee exists
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);

      // Mock create assistant
      vi.spyOn(MockMongoRepository.prototype, 'createAssistant').mockResolvedValue(
        createdAssistant,
      );

      // Mock audit history creation
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue(undefined);

      const useCase = new TrusteeAssistantsUseCase(mockContext);
      const result = await useCase.createAssistant(mockContext, trusteeId, validInput);

      expect(result).toEqual(createdAssistant);
      expect(MockMongoRepository.prototype.createAssistant).toHaveBeenCalledWith(
        trusteeId,
        validInput,
        mockContext.session.user,
      );
    });

    test('should throw error when trustee does not exist', async () => {
      const mockContext = await createMockApplicationContext();

      // Mock trustee not found
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new UnknownError(MODULE_NAME, { message: 'Trustee not found' }),
      );

      const useCase = new TrusteeAssistantsUseCase(mockContext);

      await expect(useCase.createAssistant(mockContext, trusteeId, validInput)).rejects.toThrow();
    });

    test('should throw error when name is missing', async () => {
      const mockContext = await createMockApplicationContext();

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);

      const invalidInput = { ...validInput, name: '' };
      const useCase = new TrusteeAssistantsUseCase(mockContext);

      await expect(useCase.createAssistant(mockContext, trusteeId, invalidInput)).rejects.toThrow();
    });

    test('should create audit history record after creating assistant', async () => {
      const mockContext = await createMockApplicationContext();

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createAssistant').mockResolvedValue(
        createdAssistant,
      );
      const createHistorySpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue(undefined);

      const useCase = new TrusteeAssistantsUseCase(mockContext);
      await useCase.createAssistant(mockContext, trusteeId, validInput);

      expect(createHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_ASSISTANT',
          assistantId: createdAssistant.id,
          before: undefined,
          after: createdAssistant,
        }),
      );
    });
  });
});
