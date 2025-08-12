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
