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

  // Helper to create expected query for filtering by documentType + additional field
  const createQuery = (additionalFilter: { field: string; value: string }) => ({
    conjunction: 'AND',
    values: [
      {
        condition: 'EQUALS',
        leftOperand: { name: 'documentType' },
        rightOperand: 'TRUSTEE_ASSISTANT',
      },
      {
        condition: 'EQUALS',
        leftOperand: { name: additionalFilter.field },
        rightOperand: additionalFilter.value,
      },
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
    test('should retrieve trustee assistant by ID', async () => {
      const expectedQuery = createQuery({ field: 'id', value: 'assistant-1' });
      const mockFindOne = vi.fn().mockResolvedValue(sampleAssistant);
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);

      const result = await repository.read('assistant-1');

      expect(result).toEqual(sampleAssistant);
      expect(mockFindOne).toHaveBeenCalledWith(expectedQuery);
    });

    test('should throw NotFoundError when assistant does not exist', async () => {
      const mockFindOne = vi.fn().mockResolvedValue(null);
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);

      await expect(repository.read('non-existent')).rejects.toThrow(
        'Trustee assistant with ID non-existent not found',
      );
    });

    test('should wrap database errors with context', async () => {
      const mockFindOne = vi.fn().mockRejectedValue(new Error('Database connection error'));
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);

      await expect(repository.read('assistant-1')).rejects.toThrow(
        'Failed to retrieve trustee assistant with ID assistant-1',
      );
    });
  });

  describe('getTrusteeAssistants', () => {
    test('should retrieve all assistants for a trustee', async () => {
      const expectedQuery = createQuery({ field: 'trusteeId', value: 'trustee-1' });
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
      const expectedQuery = createQuery({ field: 'trusteeId', value: 'trustee-1' });
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
});
