// Mock the factory module to prevent Okta/JWT imports
jest.mock('../../../factory', () => ({
  getUserSessionUseCase: jest.fn(),
}));

// Mock mongo-humble module components
jest.mock('../../../humble-objects/mongo-humble', () => ({
  DocumentClient: jest.fn(() => ({
    isConnected: jest.fn(() => true),
    connect: jest.fn(),
    close: jest.fn(() => Promise.resolve()),
  })),
  CollectionHumble: jest.fn(() => ({
    findOne: jest.fn(),
    find: jest.fn(),
    insertOne: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    countDocuments: jest.fn(),
  })),
}));

// Mock the crypto module
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-123'),
}));

// Mock the createAuditRecord function
jest.mock('../../../../../common/src/cams/auditable', () => ({
  createAuditRecord: jest.fn((data, user) => ({
    ...data,
    createdOn: '2025-08-12T10:00:00Z',
    createdBy: user,
  })),
}));

// Mock the crypto module
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-123'),
}));

// Mock the createAuditRecord function
jest.mock('../../../../../common/src/cams/auditable', () => ({
  createAuditRecord: jest.fn((data, user) => ({
    ...data,
    createdOn: '2025-08-12T10:00:00Z',
    createdBy: user,
  })),
}));

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
  let mockAdapter: jest.Mocked<MongoCollectionAdapter<TrusteeDocument>>;

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

    // Create a proper mock adapter - use unknown to bypass type checking for the mock
    mockAdapter = {
      insertOne: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      replaceOne: jest.fn(),
      deleteOne: jest.fn(),
      aggregate: jest.fn(),
      paginate: jest.fn(),
      getPage: jest.fn(),
      getAll: jest.fn(),
      countAllDocuments: jest.fn(),
      updateOne: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      createIndexes: jest.fn(),
      putRecord: jest.fn(),
      insertMany: jest.fn(),
      countDocuments: jest.fn(),
    } as unknown as jest.Mocked<MongoCollectionAdapter<TrusteeDocument>>;

    // Mock the getAdapter method - TypeScript doesn't know about protected methods
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(repository, 'getAdapter' as any).mockReturnValue(mockAdapter);
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
      mockAdapter.insertOne.mockResolvedValue(undefined);

      const result = await repository.createTrustee(sampleTrusteeInput, mockUser);

      expect(mockAdapter.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          ...sampleTrusteeInput,
          id: 'mock-uuid-123',
          documentType: 'TRUSTEE',
          createdOn: '2025-08-12T10:00:00Z',
          createdBy: mockUser,
        }),
      );
      expect(result.id).toBe('mock-uuid-123');
      expect(result.name).toBe(sampleTrusteeInput.name);
    });

    test('should handle creation errors', async () => {
      const error = new Error('Database connection failed');
      mockAdapter.insertOne.mockRejectedValue(error);

      await expect(repository.createTrustee(sampleTrusteeInput, mockUser)).rejects.toThrow();

      expect(mockAdapter.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          ...sampleTrusteeInput,
          id: 'mock-uuid-123',
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
          address1: '123 Main St',
          cityStateZipCountry: 'Springfield, IL 62704',
          documentType: 'TRUSTEE',
          createdOn: '2025-08-12T10:00:00Z',
          createdBy: mockUser,
        },
        {
          id: 'trustee-2',
          name: 'Jane Smith',
          address1: '456 Oak Ave',
          cityStateZipCountry: 'Chicago, IL 60601',
          documentType: 'TRUSTEE',
          createdOn: '2025-08-12T11:00:00Z',
          createdBy: mockUser,
        },
      ];

      mockAdapter.find.mockResolvedValue(mockTrustees as TrusteeDocument[]);

      const result = await repository.listTrustees();

      expect(mockAdapter.find).toHaveBeenCalledWith({
        condition: 'EQUALS',
        leftOperand: { name: 'documentType' },
        rightOperand: 'TRUSTEE',
      });
      expect(result).toEqual(mockTrustees);
      expect(result).toHaveLength(2);
    });

    test('should return empty array when no trustees exist', async () => {
      mockAdapter.find.mockResolvedValue([]);

      const result = await repository.listTrustees();

      expect(mockAdapter.find).toHaveBeenCalledWith({
        condition: 'EQUALS',
        leftOperand: { name: 'documentType' },
        rightOperand: 'TRUSTEE',
      });
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    test('should handle database errors when listing trustees', async () => {
      const error = new Error('Database connection failed');
      mockAdapter.find.mockRejectedValue(error);

      await expect(repository.listTrustees()).rejects.toThrow();

      expect(mockAdapter.find).toHaveBeenCalledWith({
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
        id: trusteeId,
        name: 'John Doe',
        address1: '123 Main St',
        cityStateZipCountry: 'Anytown, NY 12345',
        documentType: 'TRUSTEE',
        createdOn: '2025-08-12T10:00:00Z',
        createdBy: mockUser,
      };

      mockAdapter.findOne.mockResolvedValue(mockTrustee as TrusteeDocument);

      const result = await repository.read(trusteeId);

      expect(mockAdapter.findOne).toHaveBeenCalledWith({
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
      });
      expect(result).toEqual(mockTrustee);
    });

    test('should throw error when trustee is not found', async () => {
      const trusteeId = 'nonexistent-id';
      mockAdapter.findOne.mockResolvedValue(null);

      await expect(repository.read(trusteeId)).rejects.toThrow(
        'Failed to retrieve trustee with ID nonexistent-id.',
      );

      expect(mockAdapter.findOne).toHaveBeenCalledWith({
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
      });
    });

    test('should handle database errors when getting a trustee', async () => {
      const trusteeId = 'trustee-123';
      const error = new Error('Database connection failed');
      mockAdapter.findOne.mockRejectedValue(error);

      await expect(repository.read(trusteeId)).rejects.toThrow();

      expect(mockAdapter.findOne).toHaveBeenCalledWith({
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
