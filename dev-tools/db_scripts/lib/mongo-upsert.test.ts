import { describe, test, expect, vi, beforeEach } from 'vitest';

// Module-level references updated in beforeEach
let mockDeleteOne: ReturnType<typeof vi.fn>;
let mockInsertOne: ReturnType<typeof vi.fn>;
let mockConnect: () => Promise<void>;
let mockClose: () => Promise<void>;

// vi.mock() is used here as a last-resort exception per CAMS conventions.
// mongodb's MongoClient is a constructor class — vi.spyOn() can only intercept
// methods on existing instances, not intercept `new MongoClient(...)` calls.
// There is no other way to prevent real network connections in tests.
vi.mock('mongodb', () => {
  class MockMongoClient {
    connect() {
      return mockConnect();
    }
    close() {
      return mockClose();
    }
    db() {
      return {
        collection: () => ({
          deleteOne: mockDeleteOne,
          insertOne: mockInsertOne,
        }),
      };
    }
  }
  return { MongoClient: MockMongoClient };
});

import { MongoClient } from 'mongodb';
import { mongoUpsert } from './mongo-upsert.js';

describe('mongoUpsert', () => {
  beforeEach(() => {
    mockDeleteOne = vi.fn().mockResolvedValue({});
    mockInsertOne = vi.fn().mockResolvedValue({});
    mockConnect = vi.fn().mockResolvedValue(undefined);
    mockClose = vi.fn().mockResolvedValue(undefined);
  });

  test('deletes then inserts each document, keyed by id', async () => {
    const docs = [{ id: 'doc-1', caseId: '081-26-00001', status: 'active' }];
    await mongoUpsert('mongodb://test', 'cams', 'cases', docs);

    expect(mockDeleteOne).toHaveBeenCalledWith({ id: 'doc-1' });
    expect(mockInsertOne).toHaveBeenCalledWith(docs[0]);
    // delete must run before insert, never the reverse
    const deleteOrder = mockDeleteOne.mock.invocationCallOrder[0];
    const insertOrder = mockInsertOne.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(insertOrder);
  });

  test('re-seeding a doc with a changed shard-key-like field does not attempt an in-place update', async () => {
    // Simulates re-running a seed script where a field Cosmos DB shards on (e.g. caseId)
    // has a different value than a prior run. deleteOne+insertOne never modifies an
    // existing document in place, so this can never trigger an immutable-field error.
    const firstRun = [{ id: 'doc-1', caseId: '081-26-00001' }];
    const secondRun = [{ id: 'doc-1', caseId: '081-26-99999' }];

    await mongoUpsert('mongodb://test', 'cams', 'cases', firstRun);
    await mongoUpsert('mongodb://test', 'cams', 'cases', secondRun);

    expect(mockDeleteOne).toHaveBeenCalledTimes(2);
    expect(mockInsertOne).toHaveBeenNthCalledWith(2, secondRun[0]);
  });

  test('processes multiple documents in order', async () => {
    const docs = [
      { id: 'doc-1', value: 'a' },
      { id: 'doc-2', value: 'b' },
    ];
    await mongoUpsert('mongodb://test', 'cams', 'offices', docs);

    expect(mockDeleteOne).toHaveBeenCalledTimes(2);
    expect(mockInsertOne).toHaveBeenCalledTimes(2);
    expect(mockInsertOne).toHaveBeenNthCalledWith(1, docs[0]);
    expect(mockInsertOne).toHaveBeenNthCalledWith(2, docs[1]);
  });

  test('throws when a document is missing the id field', async () => {
    const docs = [{ caseId: '081-26-00001' }];
    await expect(mongoUpsert('mongodb://test', 'cams', 'cases', docs)).rejects.toThrow(
      "Document missing 'id' field in collection 'cases'",
    );
    expect(mockInsertOne).not.toHaveBeenCalled();
  });

  test('creates and closes its own client when no sharedClient is provided', async () => {
    await mongoUpsert('mongodb://test', 'cams', 'cases', [{ id: 'doc-1' }]);

    expect(mockConnect).toHaveBeenCalledOnce();
    expect(mockClose).toHaveBeenCalledOnce();
  });

  test('reuses a sharedClient without connecting or closing it', async () => {
    const sharedClient = new MongoClient('mongodb://test');
    await mongoUpsert('mongodb://test', 'cams', 'cases', [{ id: 'doc-1' }], sharedClient);

    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockClose).not.toHaveBeenCalled();
  });

  test('closes its own client even when a document fails validation', async () => {
    const docs = [{ id: 'doc-1' }, { caseId: 'missing-id' }];
    await expect(mongoUpsert('mongodb://test', 'cams', 'cases', docs)).rejects.toThrow();

    expect(mockClose).toHaveBeenCalledOnce();
  });

  test('logs each upserted document', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await mongoUpsert('mongodb://test', 'cams', 'cases', [{ id: 'doc-1' }]);

    expect(consoleSpy).toHaveBeenCalledWith('[SEED] upserted cases/doc-1');
  });
});
