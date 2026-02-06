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

  describe('getAssistant', () => {
    const assistantId = 'assistant-123';
    const mockAssistant = MockData.getTrusteeAssistant({
      id: assistantId,
      trusteeId: 'trustee-123',
    });

    test('should return assistant by ID', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockAssistant);

      const result = await trusteeAssistantsUseCase.getAssistant(context, assistantId);

      expect(result).toEqual(mockAssistant);
      expect(MockMongoRepository.prototype.read).toHaveBeenCalledWith(assistantId);
    });

    test('should throw error when assistant does not exist', async () => {
      const repositoryError = new Error('Assistant not found');
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(repositoryError);

      const actualError = await getTheThrownError(() =>
        trusteeAssistantsUseCase.getAssistant(context, assistantId),
      );

      expect(actualError.isCamsError).toBe(true);
    });

    test('should handle repository error during assistant retrieval', async () => {
      const repositoryError = new Error('Database connection error');
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(repositoryError);

      const actualError = await getTheThrownError(() =>
        trusteeAssistantsUseCase.getAssistant(context, assistantId),
      );

      expect(actualError.isCamsError).toBe(true);
    });
  });

  describe('updateAssistant', () => {
    const trusteeId = 'trustee-123';
    const assistantId = 'assistant-456';
    const existingAssistant = MockData.getTrusteeAssistant({
      id: assistantId,
      trusteeId,
      name: 'Jane Assistant',
      title: 'Legal Assistant',
    });

    const updateInput: TrusteeAssistantInput = {
      name: 'Jane Updated Assistant',
      title: 'Senior Legal Assistant',
      contact: {
        address: {
          address1: '456 Oak St',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62701',
          countryCode: 'US',
        },
        phone: {
          number: '555-987-6543',
        },
        email: 'jane.updated@example.com',
      },
    };

    const updatedAssistant = {
      ...existingAssistant,
      ...updateInput,
      updatedBy: SYSTEM_USER_REFERENCE,
      updatedOn: '2024-01-02T00:00:00Z',
    };

    test('should update an assistant with valid input', async () => {
      const mockTrustee = { id: trusteeId, name: 'Test Trustee' };
      vi.spyOn(MockMongoRepository.prototype, 'read')
        .mockResolvedValueOnce(mockTrustee)
        .mockResolvedValueOnce(existingAssistant);
      vi.spyOn(MockMongoRepository.prototype, 'updateAssistant').mockResolvedValue(
        updatedAssistant,
      );
      vi.spyOn(MockMongoRepository.prototype, 'createTrusteeHistory').mockResolvedValue(undefined);

      const result = await trusteeAssistantsUseCase.updateAssistant(
        context,
        trusteeId,
        assistantId,
        updateInput,
      );

      expect(result).toEqual(updatedAssistant);
      expect(MockMongoRepository.prototype.updateAssistant).toHaveBeenCalledWith(
        trusteeId,
        assistantId,
        updateInput,
        context.session.user,
      );
    });

    test('should throw error when trustee does not exist', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new UnknownError(MODULE_NAME, { message: 'Trustee not found' }),
      );

      await expect(
        trusteeAssistantsUseCase.updateAssistant(context, trusteeId, assistantId, updateInput),
      ).rejects.toThrow();
    });

    test('should throw error when assistant does not exist', async () => {
      const mockTrustee = { id: trusteeId, name: 'Test Trustee' };
      vi.spyOn(MockMongoRepository.prototype, 'read')
        .mockResolvedValueOnce(mockTrustee)
        .mockRejectedValueOnce(new Error('Assistant not found'));

      await expect(
        trusteeAssistantsUseCase.updateAssistant(context, trusteeId, assistantId, updateInput),
      ).rejects.toThrow();
    });

    test('should throw error when name is missing', async () => {
      const mockTrustee = { id: trusteeId, name: 'Test Trustee' };
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(mockTrustee);

      const invalidInput = { ...updateInput, name: '' };

      await expect(
        trusteeAssistantsUseCase.updateAssistant(context, trusteeId, assistantId, invalidInput),
      ).rejects.toThrow();
    });

    test('should create audit history record after updating assistant', async () => {
      const mockTrustee = { id: trusteeId, name: 'Test Trustee' };
      vi.spyOn(MockMongoRepository.prototype, 'read')
        .mockResolvedValueOnce(mockTrustee)
        .mockResolvedValueOnce(existingAssistant);
      vi.spyOn(MockMongoRepository.prototype, 'updateAssistant').mockResolvedValue(
        updatedAssistant,
      );
      const createHistorySpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue(undefined);

      await trusteeAssistantsUseCase.updateAssistant(context, trusteeId, assistantId, updateInput);

      expect(createHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_ASSISTANT',
          assistantId: assistantId,
          before: existingAssistant,
          after: updatedAssistant,
        }),
      );
    });
  });

  describe('deleteAssistant', () => {
    const trusteeId = 'trustee-123';
    const assistantId = 'assistant-456';
    const existingAssistant = MockData.getTrusteeAssistant({
      id: assistantId,
      trusteeId,
      name: 'Jane Assistant',
    });

    test('should delete an assistant and create audit history', async () => {
      const mockTrustee = MockData.getTrustee({ trusteeId });
      vi.spyOn(MockMongoRepository.prototype, 'read')
        .mockResolvedValueOnce(mockTrustee)
        .mockResolvedValueOnce(existingAssistant);
      vi.spyOn(MockMongoRepository.prototype, 'deleteAssistant').mockResolvedValue(undefined);
      const createHistorySpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrusteeHistory')
        .mockResolvedValue(undefined);

      await trusteeAssistantsUseCase.deleteAssistant(context, trusteeId, assistantId);

      expect(MockMongoRepository.prototype.deleteAssistant).toHaveBeenCalledWith(assistantId);
      expect(createHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_ASSISTANT',
          assistantId,
          before: existingAssistant,
          after: undefined,
        }),
      );
    });

    test('should throw error when trustee does not exist', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new UnknownError(MODULE_NAME, { message: 'Trustee not found' }),
      );

      const actualError = await getTheThrownError(() =>
        trusteeAssistantsUseCase.deleteAssistant(context, trusteeId, assistantId),
      );

      expect(actualError.isCamsError).toBe(true);
    });

    test('should throw error when assistant does not exist', async () => {
      const mockTrustee = MockData.getTrustee({ trusteeId });
      vi.spyOn(MockMongoRepository.prototype, 'read')
        .mockResolvedValueOnce(mockTrustee)
        .mockRejectedValueOnce(new Error('Assistant not found'));

      const actualError = await getTheThrownError(() =>
        trusteeAssistantsUseCase.deleteAssistant(context, trusteeId, assistantId),
      );

      expect(actualError.isCamsError).toBe(true);
    });

    test('should throw error when repository delete fails', async () => {
      const mockTrustee = MockData.getTrustee({ trusteeId });
      vi.spyOn(MockMongoRepository.prototype, 'read')
        .mockResolvedValueOnce(mockTrustee)
        .mockResolvedValueOnce(existingAssistant);
      vi.spyOn(MockMongoRepository.prototype, 'deleteAssistant').mockRejectedValue(
        new Error('Database error'),
      );

      const actualError = await getTheThrownError(() =>
        trusteeAssistantsUseCase.deleteAssistant(context, trusteeId, assistantId),
      );

      expect(actualError.isCamsError).toBe(true);
    });
  });
});
