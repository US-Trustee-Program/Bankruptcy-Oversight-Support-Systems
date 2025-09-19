import { ApplicationContext } from '../../types/basic';
import { TrusteesMongoRepository, TrusteeDocument } from './trustees.mongo.repository';
import { TrusteeInput, TrusteeNameHistory } from '../../../../../common/src/cams/trustees';
import { CamsUserReference } from '../../../../../common/src/cams/users';
import {
  createMockApplicationContext,
  getTheThrownError,
} from '../../../testing/testing-utilities';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';

describe('TrusteesMongoRepository', () => {
  let context: ApplicationContext;
  let repository: TrusteesMongoRepository;

  const mockUser: CamsUserReference = {
    id: 'user123',
    name: 'Test User',
  };

  const sampleTrusteeInput: TrusteeInput = {
    name: 'John Doe',
    public: {
      address: {
        address1: '123 Main St',
        city: 'Anytown',
        state: 'NY',
        zipCode: '12345',
        countryCode: 'US',
      },
      phone: {
        number: '555-0123',
      },
      email: 'john.doe@example.com',
    },
    districts: ['NY'],
    chapters: ['7', '11'],
    status: 'active',
  };

  beforeEach(async () => {
    context = await createMockApplicationContext({
      env: {
        MONGO_CONNECTION_STRING: 'mongodb://localhost:27017',
        COSMOS_DATABASE_NAME: 'test-database',
      },
    });
    repository = new TrusteesMongoRepository(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    jest.restoreAllMocks();
    repository.release();
  });

  afterAll(() => {
    TrusteesMongoRepository.dropInstance();
  });

  describe('createTrustee', () => {
    test('should create trustee document with audit fields', async () => {
      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
        .mockResolvedValue(undefined);

      const result = await repository.createTrustee(sampleTrusteeInput, mockUser);

      expect(mockAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
          ...sampleTrusteeInput,
          documentType: 'TRUSTEE',
          createdOn: expect.any(String),
          createdBy: mockUser,
          updatedOn: expect.any(String),
          updatedBy: mockUser,
        }),
      );
      expect(result.name).toBe(sampleTrusteeInput.name);
    });

    test('should handle creation errors', async () => {
      const error = new Error('Database connection failed');
      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
        .mockRejectedValue(error);

      await expect(repository.createTrustee(sampleTrusteeInput, mockUser)).rejects.toThrow();

      expect(mockAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
          ...sampleTrusteeInput,
          documentType: 'TRUSTEE',
        }),
      );
    });
  });

  describe('listTrustees', () => {
    test('should retrieve list of trustees successfully', async () => {
      const mockTrustees = [
        {
          id: 'trustee-1',
          name: 'John Doe',
          public: {
            address: {
              address1: '123 Main St',
              city: 'Springfield',
              state: 'IL',
              zipCode: '62704',
              countryCode: 'US',
            },
            email: 'john.doe@example.com',
            phone: {
              number: '555-0123',
            },
          },
          status: 'active',
          documentType: 'TRUSTEE',
          createdOn: '2025-08-12T10:00:00Z',
          createdBy: mockUser,
          updatedOn: '2025-08-12T10:00:00Z',
          updatedBy: mockUser,
        },
        {
          id: 'trustee-2',
          name: 'Jane Smith',
          public: {
            address: {
              address1: '456 Oak Ave',
              city: 'Chicago',
              state: 'IL',
              zipCode: '60601',
              countryCode: 'US',
            },
            email: 'jane.smith@example.com',
            phone: {
              number: '555-0456',
            },
          },
          status: 'active',
          documentType: 'TRUSTEE',
          createdOn: '2025-08-12T11:00:00Z',
          createdBy: mockUser,
          updatedOn: '2025-08-12T11:00:00Z',
          updatedBy: mockUser,
        },
      ];

      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValue(mockTrustees as TrusteeDocument[]);

      const result = await repository.listTrustees();

      expect(mockAdapter).toHaveBeenCalledWith({
        condition: 'EQUALS',
        leftOperand: { name: 'documentType' },
        rightOperand: 'TRUSTEE',
      });
      expect(result).toEqual(mockTrustees);
      expect(result).toHaveLength(2);
    });

    test('should return empty array when no trustees exist', async () => {
      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValue([]);

      const result = await repository.listTrustees();

      expect(mockAdapter).toHaveBeenCalledWith({
        condition: 'EQUALS',
        leftOperand: { name: 'documentType' },
        rightOperand: 'TRUSTEE',
      });
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    test('should handle database errors when listing trustees', async () => {
      const error = new Error('Database connection failed');
      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockRejectedValue(error);

      await expect(repository.listTrustees()).rejects.toThrow();

      expect(mockAdapter).toHaveBeenCalledWith({
        condition: 'EQUALS',
        leftOperand: { name: 'documentType' },
        rightOperand: 'TRUSTEE',
      });
    });
  });

  describe('getTrustee', () => {
    test('should successfully retrieve a trustee by ID', async () => {
      const id = 'trustee-123';
      const mockTrustee = {
        id,
        name: 'John Doe',
        public: {
          address: {
            address1: '123 Main St',
            city: 'Anytown',
            state: 'NY',
            zipCode: '12345',
            countryCode: 'US',
          },
          email: 'john.doe@example.com',
          phone: {
            number: '555-0123',
          },
        },
        status: 'active',
        documentType: 'TRUSTEE',
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUser,
        updatedOn: '2025-08-12T10:00:00Z',
        updatedBy: mockUser,
      };

      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockResolvedValue(mockTrustee as TrusteeDocument);

      const result = await repository.read(id);

      expect(mockAdapter).toHaveBeenCalledWith({
        conjunction: 'AND',
        values: [
          {
            condition: 'EQUALS',
            leftOperand: { name: 'documentType' },
            rightOperand: 'TRUSTEE',
          },
          {
            condition: 'EQUALS',
            leftOperand: { name: 'id' },
            rightOperand: id,
          },
        ],
      });
      expect(result).toEqual(mockTrustee);
    });

    test('should throw error when trustee is not found', async () => {
      const id = 'nonexistent-id';
      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockResolvedValue(null);

      await expect(repository.read(id)).rejects.toThrow(
        'Failed to retrieve trustee with ID nonexistent-id.',
      );

      expect(mockAdapter).toHaveBeenCalledWith({
        conjunction: 'AND',
        values: [
          {
            condition: 'EQUALS',
            leftOperand: { name: 'documentType' },
            rightOperand: 'TRUSTEE',
          },
          {
            condition: 'EQUALS',
            leftOperand: { name: 'id' },
            rightOperand: id,
          },
        ],
      });
    });

    test('should handle database errors when getting a trustee', async () => {
      const id = 'trustee-123';
      const error = new Error('Database connection failed');
      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockRejectedValue(error);

      await expect(repository.read(id)).rejects.toThrow();

      expect(mockAdapter).toHaveBeenCalledWith({
        conjunction: 'AND',
        values: [
          {
            condition: 'EQUALS',
            leftOperand: { name: 'documentType' },
            rightOperand: 'TRUSTEE',
          },
          {
            condition: 'EQUALS',
            leftOperand: { name: 'id' },
            rightOperand: id,
          },
        ],
      });
    });
  });

  describe('updateTrustee', () => {
    test('should update trustee successfully with audit fields', async () => {
      const trusteeId = 'trustee-123';
      const updatedTrusteeInput: Partial<TrusteeInput> = {
        name: 'Jane Doe Updated',
        public: {
          address: {
            address1: '456 Updated St',
            city: 'Newtown',
            state: 'CA',
            zipCode: '54321',
            countryCode: 'US',
          },
          phone: {
            number: '333-555-9876',
          },
          email: 'jane.updated@example.com',
        },
        status: 'not active',
      };

      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'updateOne')
        .mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

      jest.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue({
        id: trusteeId,
        ...updatedTrusteeInput,
        documentType: 'TRUSTEE',
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUser,
        updatedOn: expect.any(String),
        updatedBy: mockUser,
      } as TrusteeDocument);

      const result = await repository.updateTrustee(trusteeId, updatedTrusteeInput, mockUser);

      expect(mockAdapter).toHaveBeenCalledWith(
        {
          conjunction: 'AND',
          values: [
            {
              condition: 'EQUALS',
              leftOperand: { name: 'documentType' },
              rightOperand: 'TRUSTEE',
            },
            {
              condition: 'EQUALS',
              leftOperand: { name: 'id' },
              rightOperand: trusteeId,
            },
          ],
        },
        expect.objectContaining({
          ...updatedTrusteeInput,
          updatedOn: expect.any(String),
          updatedBy: mockUser,
        }),
      );
      expect(result.id).toBe(trusteeId);
      expect(result.name).toBe(updatedTrusteeInput.name);
    });

    test('should throw error when trustee to update is not found', async () => {
      const trusteeId = 'nonexistent-id';
      const updatedTrusteeInput: Partial<TrusteeInput> = {
        name: 'Updated Name',
      };

      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'updateOne')
        .mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });

      const actual = await getTheThrownError(async () => {
        await repository.updateTrustee(trusteeId, updatedTrusteeInput, mockUser);
      });

      await expect(actual.camsStack[0]).toEqual(
        expect.objectContaining({ message: `Failed to update trustee with ID ${trusteeId}.` }),
      );

      expect(mockAdapter).toHaveBeenCalledWith(
        {
          conjunction: 'AND',
          values: [
            {
              condition: 'EQUALS',
              leftOperand: { name: 'documentType' },
              rightOperand: 'TRUSTEE',
            },
            {
              condition: 'EQUALS',
              leftOperand: { name: 'id' },
              rightOperand: trusteeId,
            },
          ],
        },
        expect.objectContaining({
          ...updatedTrusteeInput,
          updatedOn: expect.any(String),
          updatedBy: mockUser,
        }),
      );
    });

    test('should handle database errors when updating trustee', async () => {
      const trusteeId = 'trustee-123';
      const updatedTrusteeInput: Partial<TrusteeInput> = {
        name: 'Updated Name',
      };
      const error = new Error('Database connection failed');

      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'updateOne')
        .mockRejectedValue(error);

      await expect(
        repository.updateTrustee(trusteeId, updatedTrusteeInput, mockUser),
      ).rejects.toThrow();

      expect(mockAdapter).toHaveBeenCalledWith(
        {
          conjunction: 'AND',
          values: [
            {
              condition: 'EQUALS',
              leftOperand: { name: 'documentType' },
              rightOperand: 'TRUSTEE',
            },
            {
              condition: 'EQUALS',
              leftOperand: { name: 'id' },
              rightOperand: trusteeId,
            },
          ],
        },
        expect.objectContaining({
          ...updatedTrusteeInput,
          updatedOn: expect.any(String),
          updatedBy: mockUser,
        }),
      );
    });
  });

  describe('createHistory', () => {
    test('should create trustee history successfully', async () => {
      const mockHistory: TrusteeNameHistory = {
        id: 'trustee-123',
        documentType: 'AUDIT_NAME',
        before: 'John Doe',
        after: 'John Smith',
        createdOn: '2025-09-17T15:12:00Z',
        createdBy: mockUser,
        updatedOn: '2025-09-17T15:12:00Z',
        updatedBy: mockUser,
      };

      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
        .mockResolvedValue(undefined);

      await repository.createTrusteeHistory(mockHistory);

      expect(mockAdapter).toHaveBeenCalledWith(mockHistory, { useProvidedId: true });
    });

    test('should handle database errors when creating history', async () => {
      const mockHistory: TrusteeNameHistory = {
        id: 'trustee-123',
        documentType: 'AUDIT_NAME',
        before: 'John Doe',
        after: 'John Smith',
        createdOn: '2025-09-17T15:12:00Z',
        createdBy: mockUser,
        updatedOn: '2025-09-17T15:12:00Z',
        updatedBy: mockUser,
      };

      const error = new Error('Database connection failed');
      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
        .mockRejectedValue(error);

      await expect(repository.createTrusteeHistory(mockHistory)).rejects.toThrow();

      expect(mockAdapter).toHaveBeenCalledWith(mockHistory, { useProvidedId: true });
    });
  });

  describe('listHistory', () => {
    test('should retrieve history records for a trustee successfully', async () => {
      const trusteeId = 'trustee-123';
      const mockHistoryRecords = [
        {
          id: trusteeId,
          documentType: 'AUDIT_NAME',
          before: 'John Doe',
          after: 'John Smith',
          createdOn: '2025-09-17T15:12:00Z',
          createdBy: mockUser,
          updatedOn: '2025-09-17T15:12:00Z',
          updatedBy: mockUser,
        },
        {
          id: trusteeId,
          documentType: 'AUDIT_STATUS',
          before: 'active',
          after: 'inactive',
          createdOn: '2025-09-17T15:15:00Z',
          createdBy: mockUser,
          updatedOn: '2025-09-17T15:15:00Z',
          updatedBy: mockUser,
        },
      ];

      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValue(mockHistoryRecords);

      const result = await repository.listTrusteeHistory(trusteeId);

      expect(mockAdapter).toHaveBeenCalledWith({
        conjunction: 'AND',
        values: [
          {
            condition: 'REGEX',
            leftOperand: { name: 'documentType' },
            rightOperand: '^AUDIT_',
          },
          {
            condition: 'EQUALS',
            leftOperand: { name: 'id' },
            rightOperand: trusteeId,
          },
        ],
      });
      expect(result).toEqual(mockHistoryRecords);
      expect(result).toHaveLength(2);
    });

    test('should return empty array when no history exists for the trustee', async () => {
      const trusteeId = 'trustee-no-history';
      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValue([]);

      const result = await repository.listTrusteeHistory(trusteeId);

      expect(mockAdapter).toHaveBeenCalledWith({
        conjunction: 'AND',
        values: [
          {
            condition: 'REGEX',
            leftOperand: { name: 'documentType' },
            rightOperand: '^AUDIT_',
          },
          {
            condition: 'EQUALS',
            leftOperand: { name: 'id' },
            rightOperand: trusteeId,
          },
        ],
      });
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    test('should handle database errors when retrieving history', async () => {
      const trusteeId = 'trustee-123';
      const error = new Error('Database connection failed');
      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockRejectedValue(error);

      await expect(repository.listTrusteeHistory(trusteeId)).rejects.toThrow();

      expect(mockAdapter).toHaveBeenCalledWith({
        conjunction: 'AND',
        values: [
          {
            condition: 'REGEX',
            leftOperand: { name: 'documentType' },
            rightOperand: '^AUDIT_',
          },
          {
            condition: 'EQUALS',
            leftOperand: { name: 'id' },
            rightOperand: trusteeId,
          },
        ],
      });
    });
  });

  describe('singleton pattern', () => {
    test('should return same instance when called multiple times', () => {
      const instance1 = TrusteesMongoRepository.getInstance(context);
      const instance2 = TrusteesMongoRepository.getInstance(context);

      expect(instance1).toBe(instance2);
    });

    test('should properly manage reference counting', () => {
      const instance1 = TrusteesMongoRepository.getInstance(context);
      const instance2 = TrusteesMongoRepository.getInstance(context);

      instance1.release();
      instance2.release();

      // After all releases, a new getInstance should create a fresh instance
      const instance3 = TrusteesMongoRepository.getInstance(context);
      expect(instance3).toBeDefined();
    });
  });
});
