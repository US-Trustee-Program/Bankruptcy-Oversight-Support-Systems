import { vi, describe, test, expect } from 'vitest';
import { Db } from 'mongodb';
import { CollectionHumble } from './mongo-humble';

describe('CollectionHumble', () => {
  test('upsertOne calls updateOne with $set/$setOnInsert split and upsert: true', async () => {
    const updateOneMock = vi.fn().mockResolvedValue({ acknowledged: true });
    const database = {
      collection: vi.fn().mockReturnValue({ updateOne: updateOneMock }),
    } as unknown as Db;
    const humble = new CollectionHumble(database, 'test-collection');

    const query = { id: { $eq: 'abc-123' } };
    const setFields = { disposition: 'auto-linked' };
    const insertOnlyFields = { createdOn: '2026-01-01' };

    await humble.upsertOne(query, setFields, insertOnlyFields);

    expect(updateOneMock).toHaveBeenCalledWith(
      query,
      { $set: setFields, $setOnInsert: insertOnlyFields },
      { upsert: true },
    );
  });
});
