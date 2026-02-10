import { vi } from 'vitest';
import { ApplicationContext } from '../../types/basic';
import { TrusteeAssistantsMongoRepository } from './trustee-assistants.mongo.repository';
import { TrusteeAssistant } from '@common/cams/trustee-assistants';
import { CamsUserReference } from '@common/cams/users';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';
import MockData from '@common/cams/test-utilities/mock-data';

describe('TrusteeAssistantsMongoRepository', () => {
  let context: ApplicationContext;
  let repository: TrusteeAssistantsMongoRepository;

  const mockUser: CamsUserReference = {
    id: 'user123',
    name: 'Test User',
  };

  const sampleAssistant: TrusteeAssistant = MockData.getTrusteeAssistant({
    id: 'assistant-1',
    trusteeId: 'trustee-1',
    name: 'Jane Doe',
    title: 'Legal Assistant',
    createdBy: mockUser,
    updatedBy: mockUser,
  });

  // Helper to create expected query for filtering by documentType + additional fields
  const createQuery = (additionalFilters: Array<{ field: string; value: string }>) => ({
    conjunction: 'AND',
    values: [
      {
        condition: 'EQUALS',
        leftOperand: { name: 'documentType' },
        rightOperand: 'TRUSTEE_ASSISTANT',
      },
      ...additionalFilters.map((filter) => ({
        condition: 'EQUALS',
        leftOperand: { name: filter.field },
        rightOperand: filter.value,
      })),
    ],
  });

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repository = new TrusteeAssistantsMongoRepository(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.restoreAllMocks();
    repository.release();
  });

  afterAll(() => {
    TrusteeAssistantsMongoRepository.dropInstance();
  });

  describe('getInstance and dropInstance', () => {
    test('should return the same instance on multiple calls', async () => {
      const instance1 = TrusteeAssistantsMongoRepository.getInstance(context);
      const instance2 = TrusteeAssistantsMongoRepository.getInstance(context);

      expect(instance1).toBe(instance2);

      instance1.release();
      instance2.release();
    });

    test('should manage reference count correctly', async () => {
      const instance1 = TrusteeAssistantsMongoRepository.getInstance(context);
      const instance2 = TrusteeAssistantsMongoRepository.getInstance(context);
      const instance3 = TrusteeAssistantsMongoRepository.getInstance(context);

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);

      instance1.release();
      instance2.release();

      const instance4 = TrusteeAssistantsMongoRepository.getInstance(context);
      expect(instance4).toBe(instance1);

      instance3.release();
      instance4.release();
    });
  });

  describe('read', () => {
    test('should retrieve trustee assistant by ID and trusteeId', async () => {
      const expectedQuery = createQuery([
        { field: 'id', value: 'assistant-1' },
        { field: 'trusteeId', value: 'trustee-1' },
      ]);
      const mockFindOne = vi.fn().mockResolvedValue(sampleAssistant);
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);

      const result = await repository.read('trustee-1', 'assistant-1');

      expect(result).toEqual(sampleAssistant);
      expect(mockFindOne).toHaveBeenCalledWith(expectedQuery);
    });

    test('should throw NotFoundError when assistant does not exist', async () => {
      const mockFindOne = vi.fn().mockResolvedValue(null);
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);

      await expect(repository.read('trustee-1', 'non-existent')).rejects.toThrow(
        'Trustee assistant with ID non-existent not found',
      );
    });

    test('should throw NotFoundError when assistant does not belong to trustee', async () => {
      const mockFindOne = vi.fn().mockResolvedValue(null);
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);

      await expect(repository.read('wrong-trustee', 'assistant-1')).rejects.toThrow(
        'Trustee assistant with ID assistant-1 not found',
      );
    });

    test('should wrap database errors with context', async () => {
      const mockFindOne = vi.fn().mockRejectedValue(new Error('Database connection error'));
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);

      await expect(repository.read('trustee-1', 'assistant-1')).rejects.toThrow(
        'Failed to retrieve trustee assistant with ID assistant-1',
      );
    });
  });

  describe('getTrusteeAssistants', () => {
    test('should retrieve all assistants for a trustee', async () => {
      const expectedQuery = createQuery([{ field: 'trusteeId', value: 'trustee-1' }]);
      const assistant1 = MockData.getTrusteeAssistant({
        id: 'assistant-1',
        trusteeId: 'trustee-1',
        name: 'Jane Doe',
      });
      const assistant2 = MockData.getTrusteeAssistant({
        id: 'assistant-2',
        trusteeId: 'trustee-1',
        name: 'John Smith',
      });

      const mockFind = vi.fn().mockResolvedValue([assistant1, assistant2]);
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockImplementation(mockFind);

      const result = await repository.getTrusteeAssistants('trustee-1');

      expect(result).toEqual([assistant1, assistant2]);
      expect(mockFind).toHaveBeenCalledWith(expectedQuery);
    });

    test('should return empty array when trustee has no assistants', async () => {
      const expectedQuery = createQuery([{ field: 'trusteeId', value: 'trustee-1' }]);
      const mockFind = vi.fn().mockResolvedValue([]);
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockImplementation(mockFind);

      const result = await repository.getTrusteeAssistants('trustee-1');

      expect(result).toEqual([]);
      expect(mockFind).toHaveBeenCalledWith(expectedQuery);
    });

    test('should handle database errors gracefully', async () => {
      const mockFind = vi.fn().mockRejectedValue(new Error('Connection timeout'));
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockImplementation(mockFind);

      await expect(repository.getTrusteeAssistants('trustee-1')).rejects.toThrow(
        'Failed to retrieve assistants for trustee trustee-1',
      );
    });
  });

  describe('createAssistant', () => {
    test('should create a new assistant', async () => {
      const assistantInput = {
        name: 'Jane Doe',
        title: 'Legal Assistant',
        contact: MockData.getContactInformation(),
      };

      const mockInsertOne = vi.fn().mockResolvedValue('new-assistant-id');
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockImplementation(mockInsertOne);

      const result = await repository.createAssistant('trustee-1', assistantInput, mockUser);

      expect(result).toEqual(
        expect.objectContaining({
          id: 'new-assistant-id',
          trusteeId: 'trustee-1',
          name: 'Jane Doe',
          title: 'Legal Assistant',
        }),
      );
      expect(mockInsertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          trusteeId: 'trustee-1',
          documentType: 'TRUSTEE_ASSISTANT',
          name: 'Jane Doe',
          title: 'Legal Assistant',
          createdBy: mockUser,
        }),
      );
    });

    test('should wrap database errors with context', async () => {
      const assistantInput = {
        name: 'Jane Doe',
      };

      const mockInsertOne = vi.fn().mockRejectedValue(new Error('Database error'));
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockImplementation(mockInsertOne);

      await expect(
        repository.createAssistant('trustee-1', assistantInput, mockUser),
      ).rejects.toThrow('Failed to create trustee assistant for trustee trustee-1');
    });
  });

  describe('updateAssistant', () => {
    test('should update an existing assistant', async () => {
      const existingAssistant = MockData.getTrusteeAssistant({
        id: 'assistant-1',
        trusteeId: 'trustee-1',
        name: 'Jane Doe',
        title: 'Legal Assistant',
      });

      const updateInput = {
        name: 'Jane Smith',
        title: 'Senior Legal Assistant',
      };

      const mockFindOne = vi.fn().mockResolvedValue(existingAssistant);
      const mockReplaceOne = vi.fn().mockResolvedValue(undefined);

      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockImplementation(mockReplaceOne);

      const result = await repository.updateAssistant(
        'trustee-1',
        'assistant-1',
        updateInput,
        mockUser,
      );

      expect(result).toEqual(
        expect.objectContaining({
          id: 'assistant-1',
          trusteeId: 'trustee-1',
          name: 'Jane Smith',
          title: 'Senior Legal Assistant',
          updatedBy: mockUser,
        }),
      );
      expect(mockReplaceOne).toHaveBeenCalled();
    });

    test('should throw NotFoundError when assistant does not exist', async () => {
      const updateInput = {
        name: 'Jane Smith',
      };

      const mockFindOne = vi.fn().mockResolvedValue(null);
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);

      await expect(
        repository.updateAssistant('trustee-1', 'non-existent', updateInput, mockUser),
      ).rejects.toThrow('Trustee assistant with ID non-existent not found');
    });

    test('should throw NotFoundError when assistant does not belong to trustee', async () => {
      const updateInput = {
        name: 'Jane Smith',
      };

      const mockFindOne = vi.fn().mockResolvedValue(null);
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);

      await expect(
        repository.updateAssistant('trustee-1', 'assistant-1', updateInput, mockUser),
      ).rejects.toThrow('Trustee assistant with ID assistant-1 not found');
    });

    test('should wrap database errors with context', async () => {
      const existingAssistant = MockData.getTrusteeAssistant({
        id: 'assistant-1',
        trusteeId: 'trustee-1',
        name: 'Jane Doe',
      });

      const updateInput = {
        name: 'Jane Smith',
      };

      const mockFindOne = vi.fn().mockResolvedValue(existingAssistant);
      const mockReplaceOne = vi.fn().mockRejectedValue(new Error('Database error'));

      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockImplementation(mockReplaceOne);

      await expect(
        repository.updateAssistant('trustee-1', 'assistant-1', updateInput, mockUser),
      ).rejects.toThrow('Failed to update trustee assistant assistant-1');
    });
  });

  describe('deleteAssistant', () => {
    test('should delete an assistant by ID and trusteeId', async () => {
      const expectedQuery = createQuery([
        { field: 'id', value: 'assistant-1' },
        { field: 'trusteeId', value: 'trustee-1' },
      ]);
      const mockDeleteOne = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockImplementation(mockDeleteOne);

      await repository.deleteAssistant('trustee-1', 'assistant-1');

      expect(mockDeleteOne).toHaveBeenCalledWith(expectedQuery);
    });

    test('should throw NotFoundError when assistant does not belong to trustee', async () => {
      const mockDeleteOne = vi.fn().mockRejectedValue(new Error('No document found'));
      vi.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockImplementation(mockDeleteOne);

      await expect(repository.deleteAssistant('wrong-trustee', 'assistant-1')).rejects.toThrow(
        'Failed to delete trustee assistant assistant-1',
      );
    });

    test('should wrap database errors with context', async () => {
      const mockDeleteOne = vi.fn().mockRejectedValue(new Error('Database error'));
      vi.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockImplementation(mockDeleteOne);

      await expect(repository.deleteAssistant('trustee-1', 'assistant-1')).rejects.toThrow(
        'Failed to delete trustee assistant assistant-1',
      );
    });
  });
});
