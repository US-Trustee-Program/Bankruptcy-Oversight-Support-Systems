import { vi } from 'vitest';
import { ApplicationContext } from '../../types/basic';
import { ListsMongoRepository } from './lists.mongo.repository';
import {
  BankList,
  BankruptcySoftwareList,
  BankruptcySoftwareListItem,
  BankListItem,
} from '@common/cams/lists';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';
import { Creatable } from '@common/cams/creatable';

const mockAggregate = vi.fn();
const mockInsertOne = vi.fn();
const mockDeleteOne = vi.fn();

describe('ListsMongoRepository', () => {
  let context: ApplicationContext;
  let repository: ListsMongoRepository;

  beforeEach(async () => {
    mockAggregate.mockReset();
    mockInsertOne.mockReset();
    mockDeleteOne.mockReset();
    vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockImplementation(mockInsertOne);
    vi.spyOn(MongoCollectionAdapter.prototype, 'aggregate').mockImplementation(mockAggregate);
    vi.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockImplementation(mockDeleteOne);
    context = await createMockApplicationContext({
      env: {
        MONGO_CONNECTION_STRING: 'mongodb://localhost:27017',
        COSMOS_DATABASE_NAME: 'test-database',
      },
    });
    repository = new ListsMongoRepository(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.restoreAllMocks();
    repository.release();
  });

  afterAll(() => {
    ListsMongoRepository.dropInstance();
  });

  describe('constructor', () => {
    test('should initialize with correct parameters', () => {
      expect(repository).toBeInstanceOf(ListsMongoRepository);
    });
  });

  describe('getInstance', () => {
    test('should return the same instance when called multiple times', () => {
      const instance1 = ListsMongoRepository.getInstance(context);
      const instance2 = ListsMongoRepository.getInstance(context);

      expect(instance1).toBe(instance2);
    });

    test('should create a new instance when none exists', () => {
      // First make sure we don't have an instance
      ListsMongoRepository.dropInstance();

      // Then get an instance and check it's valid
      const instance = ListsMongoRepository.getInstance(context);

      expect(instance).toBeInstanceOf(ListsMongoRepository);
    });

    test('should increment reference count', () => {
      // Access private referenceCount through any hack
      const privateInstance = ListsMongoRepository as unknown as { referenceCount: number };

      // First reset
      ListsMongoRepository.dropInstance();
      expect(privateInstance.referenceCount).toBe(0);

      // Get an instance which should increment the count
      ListsMongoRepository.getInstance(context);
      expect(privateInstance.referenceCount).toBe(1);

      // Get another instance which should increment the count again
      ListsMongoRepository.getInstance(context);
      expect(privateInstance.referenceCount).toBe(2);
    });
  });

  describe('dropInstance', () => {
    test('should decrement reference count', () => {
      const privateInstance = ListsMongoRepository as unknown as { referenceCount: number };

      // Reset and create two instances
      ListsMongoRepository.dropInstance();
      ListsMongoRepository.getInstance(context);
      ListsMongoRepository.getInstance(context);
      expect(privateInstance.referenceCount).toBe(2);

      // Drop one instance
      ListsMongoRepository.dropInstance();
      expect(privateInstance.referenceCount).toBe(1);
    });
  });

  describe('release', () => {
    test('should call dropInstance', () => {
      const dropInstanceSpy = vi.spyOn(ListsMongoRepository, 'dropInstance');

      repository.release();

      expect(dropInstanceSpy).toHaveBeenCalled();
    });
  });

  describe('getBankList', () => {
    test('should return banks list from adapter', async () => {
      const mockBankList: BankList = [
        { _id: '1', list: 'banks', key: 'bank1', value: 'Bank One' },
        { _id: '2', list: 'banks', key: 'bank2', value: 'Bank Two' },
      ];
      mockAggregate.mockResolvedValue(mockBankList);
      const result = await repository.getBankList();
      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toEqual(mockBankList);
    });

    test('should handle database errors', async () => {
      const error = new Error('Failed to get bank list');
      mockAggregate.mockRejectedValue(error);
      await expect(repository.getBankList()).rejects.toThrow();
    });
  });

  describe('getBankruptcySoftwareList', () => {
    test('should return bankruptcy software list from adapter', async () => {
      const mockSoftwareList: BankruptcySoftwareList = [
        { _id: '1', list: 'bankruptcy-software', key: 'software1', value: 'Software One' },
        { _id: '2', list: 'bankruptcy-software', key: 'software2', value: 'Software Two' },
      ];
      mockAggregate.mockResolvedValue(mockSoftwareList);
      const result = await repository.getBankruptcySoftwareList();
      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toEqual(mockSoftwareList);
    });

    test('should handle database errors', async () => {
      const error = new Error('Failed to get software list');
      mockAggregate.mockRejectedValue(error);
      await expect(repository.getBankruptcySoftwareList()).rejects.toThrow();
    });
  });

  describe('postBankruptcySoftware', () => {
    test('should create bankruptcy software item in database', async () => {
      const mockItemId = '12345';
      const itemToCreate: Creatable<BankruptcySoftwareListItem> = {
        list: 'bankruptcy-software' as const,
        key: 'new-software',
        value: 'New Software',
      };
      mockInsertOne.mockResolvedValue(mockItemId);
      const result = await repository.postBankruptcySoftware(itemToCreate);
      expect(mockInsertOne).toHaveBeenCalledWith(itemToCreate);
      expect(result).toEqual(mockItemId);
    });

    test('should handle database errors when creating bankruptcy software', async () => {
      const error = new Error('Failed to create bankruptcy software');
      const itemToCreate: Creatable<BankruptcySoftwareListItem> = {
        list: 'bankruptcy-software' as const,
        key: 'new-software',
        value: 'New Software',
      };
      mockInsertOne.mockRejectedValue(error);
      await expect(repository.postBankruptcySoftware(itemToCreate)).rejects.toThrow();
    });
  });

  describe('postBank', () => {
    test('should create bank item in database', async () => {
      const mockItemId = '67890';
      const itemToCreate: Creatable<BankListItem> = {
        list: 'banks' as const,
        key: 'new-bank',
        value: 'New Bank',
      };
      mockInsertOne.mockResolvedValue(mockItemId);
      const result = await repository.postBank(itemToCreate);
      expect(mockInsertOne).toHaveBeenCalledWith(itemToCreate);
      expect(result).toEqual(mockItemId);
    });

    test('should handle database errors when creating bank', async () => {
      const error = new Error('Failed to create bank');
      const itemToCreate: Creatable<BankListItem> = {
        list: 'banks' as const,
        key: 'new-bank',
        value: 'New Bank',
      };
      mockInsertOne.mockRejectedValue(error);
      await expect(repository.postBank(itemToCreate)).rejects.toThrow();
    });
  });

  describe('deleteBankruptcySoftware', () => {
    test('should delete bankruptcy software item from database', async () => {
      const itemId = '12345';
      // Mock with the correct result structure expected by deleteOne
      mockDeleteOne.mockResolvedValue({ deletedCount: 1 });
      await repository.deleteBankruptcySoftware(itemId);
      expect(mockDeleteOne).toHaveBeenCalled();
      expect(mockDeleteOne).toHaveBeenCalledTimes(1);
    });

    test('should handle database errors when deleting bankruptcy software', async () => {
      const error = new Error('Failed to delete bankruptcy software');
      const itemId = '12345';
      mockDeleteOne.mockRejectedValue(error);
      await expect(repository.deleteBankruptcySoftware(itemId)).rejects.toThrow();
    });
  });

  describe('deleteBank', () => {
    test('should delete bank item from database', async () => {
      const itemId = '67890';
      // Mock with the correct result structure expected by deleteOne
      mockDeleteOne.mockResolvedValue({ deletedCount: 1 });
      await repository.deleteBank(itemId);
      expect(mockDeleteOne).toHaveBeenCalled();
      expect(mockDeleteOne).toHaveBeenCalledTimes(1);
    });

    test('should handle database errors when deleting bank', async () => {
      const error = new Error('Failed to delete bank');
      const itemId = '67890';
      mockDeleteOne.mockRejectedValue(error);
      await expect(repository.deleteBank(itemId)).rejects.toThrow();
    });
  });
});
