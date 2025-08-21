import { ApplicationContext } from '../../types/basic';
import { TrusteesMongoRepository, TrusteeDocument } from './trustees.mongo.repository';
import { TrusteeInput } from '../../../../../common/src/cams/parties';
import { CamsUserReference } from '../../../../../common/src/cams/users';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
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
    address1: '123 Main St',
    cityStateZipCountry: 'Anytown, NY 12345',
    phone: '555-0123',
    email: 'john.doe@example.com',
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
          trusteeId: expect.any(String),
          documentType: 'TRUSTEE',
          createdOn: expect.any(String),
          createdBy: mockUser,
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
          trusteeId: expect.any(String),
          documentType: 'TRUSTEE',
        }),
      );
    });
  });

  describe('listTrustees', () => {
    test('should retrieve list of trustees successfully', async () => {
      const mockTrustees = [
        {
          trusteeId: 'trustee-1',
          name: 'John Doe',
          address1: '123 Main St',
          cityStateZipCountry: 'Springfield, IL 62704',
          documentType: 'TRUSTEE',
          createdOn: '2025-08-12T10:00:00Z',
          createdBy: mockUser,
        },
        {
          trusteeId: 'trustee-2',
          name: 'Jane Smith',
          address1: '456 Oak Ave',
          cityStateZipCountry: 'Chicago, IL 60601',
          documentType: 'TRUSTEE',
          createdOn: '2025-08-12T11:00:00Z',
          createdBy: mockUser,
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
      const trusteeId = 'trustee-123';
      const mockTrustee = {
        trusteeId,
        name: 'John Doe',
        address1: '123 Main St',
        cityStateZipCountry: 'Anytown, NY 12345',
        documentType: 'TRUSTEE',
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUser,
      };

      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockResolvedValue(mockTrustee as TrusteeDocument);

      const result = await repository.read(trusteeId);

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
            leftOperand: { name: 'trusteeId' },
            rightOperand: trusteeId,
          },
        ],
      });
      expect(result).toEqual(mockTrustee);
    });

    test('should throw error when trustee is not found', async () => {
      const trusteeId = 'nonexistent-id';
      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockResolvedValue(null);

      await expect(repository.read(trusteeId)).rejects.toThrow(
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
            leftOperand: { name: 'trusteeId' },
            rightOperand: trusteeId,
          },
        ],
      });
    });

    test('should handle database errors when getting a trustee', async () => {
      const trusteeId = 'trustee-123';
      const error = new Error('Database connection failed');
      const mockAdapter = jest
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockRejectedValue(error);

      await expect(repository.read(trusteeId)).rejects.toThrow();

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
            leftOperand: { name: 'trusteeId' },
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
