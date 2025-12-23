import { vi } from 'vitest';

/**
 * Database Driver Mocks
 *
 * These mocks prevent real database connections while testing production code paths.
 * vitest hoists vi.mock() calls, so these run before server initialization.
 *
 * Import this file at the top of any test that needs database driver mocks:
 * import '../../helpers/driver-mocks';
 */

// IMPORTANT: Mock MongoDB driver BEFORE any imports that use it
vi.mock('mongodb', () => {
  // Create a proper mock cursor that is async iterable
  class MockCursor {
    private index = 0;

    constructor(
      private data: unknown[] = [],
      private isAggregation = false,
    ) {}

    async toArray() {
      return this.data;
    }

    // MongoDB cursor.next() method
    async next() {
      // For aggregations with $facet (pagination), return facet structure
      if (this.isAggregation && this.index === 0) {
        this.index++;
        return {
          metadata: [{ total: this.data.length }],
          data: this.data,
        };
      }

      // For regular cursors, return items one at a time
      if (this.index < this.data.length) {
        return this.data[this.index++];
      }
      return null;
    }

    // Make the cursor async iterable
    async *[Symbol.asyncIterator]() {
      for (const item of this.data) {
        yield item;
      }
    }
  }

  class MockMongoClient {
    constructor(_connectionString: string) {}
    async connect() {
      return this;
    }
    async close() {}
    db(_name: string) {
      return {
        collection: (_collectionName: string) => ({
          find: () => new MockCursor([]),
          findOne: async () => null,
          insertOne: async () => ({ insertedId: 'mock-id', acknowledged: true }),
          insertMany: async () => ({ insertedIds: [], acknowledged: true }),
          updateOne: async () => ({ modifiedCount: 1, acknowledged: true }),
          replaceOne: async () => ({
            modifiedCount: 1,
            upsertedCount: 0,
            upsertedId: null,
            acknowledged: true,
          }),
          deleteOne: async () => ({ deletedCount: 1, acknowledged: true }),
          deleteMany: async () => ({ deletedCount: 0, acknowledged: true }),
          countDocuments: async () => 0,
          aggregate: () => new MockCursor([], true), // true = isAggregation
          bulkWrite: async () => ({ insertedCount: 0, acknowledged: true }),
        }),
      };
    }
  }

  // Also need to mock Db class for the humble object
  class MockDb {
    constructor(_client: unknown, _name: string) {}
    collection(_name: string) {
      return {
        find: () => new MockCursor([]),
        findOne: async () => null,
        insertOne: async () => ({ insertedId: 'mock-id', acknowledged: true }),
        insertMany: async () => ({ insertedIds: [], acknowledged: true }),
        updateOne: async () => ({ modifiedCount: 1, acknowledged: true }),
        replaceOne: async () => ({
          modifiedCount: 1,
          upsertedCount: 0,
          upsertedId: null,
          acknowledged: true,
        }),
        deleteOne: async () => ({ deletedCount: 1, acknowledged: true }),
        deleteMany: async () => ({ deletedCount: 0, acknowledged: true }),
        countDocuments: async () => 0,
        aggregate: () => new MockCursor([], true), // true = isAggregation
        bulkWrite: async () => ({ insertedCount: 0, acknowledged: true }),
      };
    }
  }

  return {
    MongoClient: MockMongoClient,
    Db: MockDb,
  };
});

// Mock MSSQL driver BEFORE any imports that use it
vi.mock('mssql', () => {
  class MockConnectionPool {
    connected = false;
    constructor(_config: unknown) {}
    async connect() {
      this.connected = true;
      return this;
    }
    async close() {
      this.connected = false;
    }
    request() {
      return {
        input: vi.fn().mockReturnThis(),
        query: vi.fn().mockResolvedValue({ recordset: [], rowsAffected: [0] }),
      };
    }
  }

  // Mock MSSQL types (these are actually functions that return type objects)
  const MockVarChar = vi.fn();
  const MockInt = vi.fn();
  const MockBit = vi.fn();
  const MockDateTime = vi.fn();
  const MockNVarChar = vi.fn();

  return {
    ConnectionPool: MockConnectionPool,
    VarChar: MockVarChar,
    Int: MockInt,
    Bit: MockBit,
    DateTime: MockDateTime,
    NVarChar: MockNVarChar,
  };
});

// Mock LaunchDarkly SDK for backend BEFORE any imports
// This provides default feature flag behavior; individual tests can override via spyOn
vi.mock('@launchdarkly/node-server-sdk', () => {
  const mockClient = {
    waitForInitialization: vi.fn().mockResolvedValue(undefined),
    allFlagsState: vi.fn().mockResolvedValue({
      allValues: () => ({}), // Default: no flags enabled
    }),
    flush: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
  };

  return {
    default: {
      init: vi.fn().mockReturnValue(mockClient),
    },
    init: vi.fn().mockReturnValue(mockClient),
  };
});

// Mock LaunchDarkly SDK for frontend BEFORE any imports
// This provides default feature flag behavior; individual tests can override via spyOn
vi.mock('launchdarkly-react-client-sdk', () => ({
  withLDProvider: (_config: unknown) => (Component: unknown) => Component,
  useFlags: () => ({}), // Default: no flags enabled
  useLDClient: () => ({
    identify: vi.fn(),
  }),
}));
