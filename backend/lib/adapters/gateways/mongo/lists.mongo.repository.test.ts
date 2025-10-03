import { ApplicationContext } from '../../types/basic';
import { ListsMongoRepository } from './lists.mongo.repository';
import { BankList, BankruptcySoftwareList } from '../../../../../common/src/cams/lists';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';

describe('ListsMongoRepository', () => {
  let context: ApplicationContext;
  let repository: ListsMongoRepository;

  beforeEach(async () => {
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
    jest.restoreAllMocks();
    repository.release();
  });

  afterAll(() => {
    ListsMongoRepository.dropInstance();
  });

  describe('constructor', () => {
    test('should initialize with correct parameters', () => {
      // The constructor calls the BaseMongoRepository constructor
      // which initializes the connection. Nothing to assert here
      // beyond that the object was created without errors.
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
      const dropInstanceSpy = jest.spyOn(ListsMongoRepository, 'dropInstance');

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

      // Mock the adapter's find method directly
      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValue(mockBankList);

      const result = await repository.getBankList();

      expect(mockAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
          condition: 'EQUALS',
          leftOperand: { name: 'list' },
          rightOperand: 'banks',
        }),
      );
      expect(result).toEqual(mockBankList);
    });

    test('should handle database errors', async () => {
      const error = new Error('Failed to get bank list');

      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(error);

      await expect(repository.getBankList()).rejects.toThrow();
    });
  });

  describe('getBankruptcySoftwareList', () => {
    test('should return bankruptcy software list from adapter', async () => {
      const mockSoftwareList: BankruptcySoftwareList = [
        { _id: '1', list: 'bankruptcy-software', key: 'software1', value: 'Software One' },
        { _id: '2', list: 'bankruptcy-software', key: 'software2', value: 'Software Two' },
      ];

      // Mock the adapter's find method directly
      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValue(mockSoftwareList);

      const result = await repository.getBankruptcySoftwareList();

      expect(mockAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
          condition: 'EQUALS',
          leftOperand: { name: 'list' },
          rightOperand: 'bankruptcy-software',
        }),
      );
      expect(result).toEqual(mockSoftwareList);
    });

    test('should handle database errors', async () => {
      const error = new Error('Failed to get software list');

      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(error);

      await expect(repository.getBankruptcySoftwareList()).rejects.toThrow();
    });
  });
});
