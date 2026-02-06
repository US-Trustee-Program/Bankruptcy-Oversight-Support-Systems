import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext, getTheThrownError } from '../../testing/testing-utilities';
import MockData from '@common/cams/test-utilities/mock-data';
import { TrusteeAssistantsUseCase } from './trustee-assistants';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { TrusteeAssistantInput } from '@common/cams/trustee-assistants';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { UnknownError } from '../../common-errors/unknown-error';

const MODULE_NAME = 'TRUSTEE-ASSISTANTS-USE-CASE';

describe('TrusteeAssistantsUseCase', () => {
  let context: ApplicationContext;
  let trusteeAssistantsUseCase: TrusteeAssistantsUseCase;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    trusteeAssistantsUseCase = new TrusteeAssistantsUseCase(context);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getTrusteeAssistants', () => {
    test('should return list of assistants for a trustee', async () => {
      const trusteeId = 'trustee-123';
      const mockTrustee = MockData.getTrustee({ trusteeId });
      const mockAssistants = [
        MockData.getTrusteeAssistant({ trusteeId }),
        MockData.getTrusteeAssistant({ trusteeId }),
      ];

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'getTrusteeAssistants').mockResolvedValue(
        mockAssistants,
      );

      const result = await trusteeAssistantsUseCase.getTrusteeAssistants(context, trusteeId);

      expect(result).toEqual(mockAssistants);
      expect(MockMongoRepository.prototype.read).toHaveBeenCalledWith(trusteeId);
      expect(MockMongoRepository.prototype.getTrusteeAssistants).toHaveBeenCalledWith(trusteeId);
    });

    test('should return empty array when trustee has no assistants', async () => {
      const trusteeId = 'trustee-456';
      const mockTrustee = MockData.getTrustee({ trusteeId });

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'getTrusteeAssistants').mockResolvedValue([]);

      const result = await trusteeAssistantsUseCase.getTrusteeAssistants(context, trusteeId);

      expect(result).toEqual([]);
      expect(MockMongoRepository.prototype.read).toHaveBeenCalledWith(trusteeId);
    });

    test('should throw error when trustee does not exist', async () => {
      const trusteeId = 'non-existent-trustee';
      const repositoryError = new Error('Trustee not found');

      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(repositoryError);

      const actualError = await getTheThrownError(() =>
        trusteeAssistantsUseCase.getTrusteeAssistants(context, trusteeId),
      );

      expect(actualError.isCamsError).toBe(true);
      expect(actualError.message).toContain(
        `Failed to retrieve assistants for trustee with ID ${trusteeId}`,
      );
    });

    test('should handle repository error during assistants retrieval', async () => {
      const trusteeId = 'trustee-123';
      const mockTrustee = MockData.getTrustee({ trusteeId });
      const repositoryError = new Error('Database error');

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'getTrusteeAssistants').mockRejectedValue(
        repositoryError,
      );

      const actualError = await getTheThrownError(() =>
        trusteeAssistantsUseCase.getTrusteeAssistants(context, trusteeId),
      );

      expect(actualError.isCamsError).toBe(true);
    });
  });

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
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createAssistant').mockResolvedValue(
        createdAssistant,
      );
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue(undefined);

      const result = await trusteeAssistantsUseCase.createAssistant(context, trusteeId, validInput);

      expect(result).toEqual(createdAssistant);
      expect(MockMongoRepository.prototype.createAssistant).toHaveBeenCalledWith(
        trusteeId,
        validInput,
        context.session.user,
      );
    });

    test('should throw error when trustee does not exist', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new UnknownError(MODULE_NAME, { message: 'Trustee not found' }),
      );

      await expect(
        trusteeAssistantsUseCase.createAssistant(context, trusteeId, validInput),
      ).rejects.toThrow();
    });

    test('should throw error when name is missing', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);

      const invalidInput = { ...validInput, name: '' };

      await expect(
        trusteeAssistantsUseCase.createAssistant(context, trusteeId, invalidInput),
      ).rejects.toThrow();
    });

    test('should create audit history record after creating assistant', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);
      vi.spyOn(MockMongoRepository.prototype, 'createAssistant').mockResolvedValue(
        createdAssistant,
      );
      const createHistorySpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue(undefined);

      await trusteeAssistantsUseCase.createAssistant(context, trusteeId, validInput);

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
