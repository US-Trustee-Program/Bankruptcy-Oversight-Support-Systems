import { vi } from 'vitest';
import { CollectionHumble, DocumentClient } from '../../../../humble-objects/mongo-humble';
import QueryBuilder from '../../../../query/query-builder';
import QueryPipeline from '../../../../query/query-pipeline';
import { MongoCollectionAdapter, removeIds } from './mongo-adapter';

const { and, orderBy } = QueryBuilder;

const MODULE_NAME = 'TEST-MODULE';
const ADAPTER_MODULE_NAME = MODULE_NAME + '_ADAPTER';

const find = vi.fn();
const findOne = vi.fn();
const paginate = vi.fn();
const replaceOne = vi.fn();
const updateOne = vi.fn();
const insertOne = vi.fn();
const insertMany = vi.fn();
const deleteOne = vi.fn();
const deleteMany = vi.fn();
const countDocuments = vi.fn();
const aggregate = vi.fn();

const spies = {
  find,
  findOne,
  paginate,
  replaceOne,
  updateOne,
  insertOne,
  insertMany,
  deleteOne,
  deleteMany,
  countDocuments,
  aggregate,
};

type TestType = {
  _id?: unknown;
  id?: string;
  foo?: string;
};

describe('Mongo adapter', () => {
  const testQuery = and();
  const humbleCollection = spies as unknown as CollectionHumble<TestType>;
  const adapter = new MongoCollectionAdapter<TestType>(MODULE_NAME, humbleCollection);

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('should return an instance of the adapter from newAdapter', () => {
    const mockClient: DocumentClient = {
      database: () => {
        return {
          collection: <_t>() => {},
        };
      },
    } as unknown as DocumentClient;
    const adapter = MongoCollectionAdapter.newAdapter<TestType>(
      'module',
      'collection',
      'database',
      mockClient,
    );
    expect(adapter).toBeInstanceOf(MongoCollectionAdapter);
  });

  test('should return items from a getAll', async () => {
    find.mockResolvedValue([{}, {}, {}]);
    const item = await adapter.getAll();
    expect(item).toEqual([{}, {}, {}]);
    expect(find).toHaveBeenCalled();
  });

  // TODO: maybe remove this?
  test('should remove Ids from an item', async () => {
    const expectedItem = { arbitraryValue: 'arbitrary-value' };
    const item = { _id: 'some_id', id: 'someId', ...expectedItem };
    expect(removeIds(item)).toEqual(expectedItem);
  });

  test('should return a sorted list of items from a getAll', async () => {
    function* generator() {
      yield Promise.resolve({});
      yield Promise.resolve({});
      yield Promise.resolve({});
    }
    const sort = vi.fn().mockImplementation(generator);
    find.mockResolvedValue({ sort });
    const item = await adapter.getAll(orderBy(['foo', 'ASCENDING']));
    expect(item).toEqual([{}, {}, {}]);
    expect(find).toHaveBeenCalled();
    expect(sort).toHaveBeenCalled();
  });

  test('should return a list of items from a find', async () => {
    find.mockResolvedValue([{}, {}, {}]);
    const item = await adapter.find(testQuery);
    expect(item).toEqual([{}, {}, {}]);
    expect(find).toHaveBeenCalled();
  });

  test('should return a sorted list of items from a find', async () => {
    function* generator() {
      yield Promise.resolve({});
      yield Promise.resolve({});
      yield Promise.resolve({});
    }
    const sort = vi.fn().mockImplementation(generator);
    find.mockResolvedValue({ sort });
    const item = await adapter.find(testQuery, orderBy(['foo', 'ASCENDING']));
    expect(item).toEqual([{}, {}, {}]);
    expect(find).toHaveBeenCalled();
    expect(sort).toHaveBeenCalled();
  });

  test('should return a sorted list of items from paginate', async () => {
    const expectedValue = {
      metadata: { total: 3 },
      data: [{}, {}, {}],
    };
    aggregate.mockResolvedValue({
      next: () => {
        return Promise.resolve({
          metadata: [{ total: 3 }],
          data: [{}, {}, {}],
        });
      },
    });

    const item = await adapter.paginate(
      QueryPipeline.pipeline(
        QueryPipeline.match(testQuery),
        QueryPipeline.sort({ field: { name: 'foo' }, direction: 'ASCENDING' }),
        QueryPipeline.paginate(0, 25),
      ),
    );
    expect(item).toEqual(expectedValue);
  });

  test('should return an empty list of items if find returns nothing', async () => {
    find.mockResolvedValue([]);
    const item = await adapter.find(testQuery);
    expect(item).toEqual([]);
  });

  test('should return a single items from a findOne', async () => {
    findOne.mockResolvedValue({ one: 'foo' });
    const item = await adapter.findOne(testQuery);
    expect(item).toEqual({ one: 'foo' });
  });

  test('should throw NotFound from findOne when a doc is not returned', async () => {
    findOne.mockResolvedValue(null);
    await expect(adapter.findOne(testQuery)).rejects.toThrow(
      expect.objectContaining({
        status: 404,
        message: 'No matching item found.',
        module: ADAPTER_MODULE_NAME,
      }),
    );
  });

  test('should return a single Id from replaceOne', async () => {
    const testObject: TestType = { id: '12345', foo: 'bar' };
    const _id = 'mongoGeneratedId';
    replaceOne.mockResolvedValue({
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
      upsertedId: _id,
      upsertedCount: 0,
    });

    const expected = {
      id: testObject.id,
      modifiedCount: 1,
      upsertedCount: 0,
    };

    const result = await adapter.replaceOne(testQuery, testObject);
    expect(result).not.toEqual({ ...expected, id: _id });
    expect(result).toEqual(expected);
  });

  test('should throw an error calling replaceOne for a nonexistent record and upsert=false', async () => {
    const testObject: TestType = { id: '12345', foo: 'bar' };
    replaceOne.mockResolvedValue({
      acknowledged: true,
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 0,
      upsertedId: null,
    });
    await expect(adapter.replaceOne(testQuery, testObject)).rejects.toThrow(
      'No matching item found.',
    );
  });

  const matchedCountCases = [
    ['acknowledged and found 1', true, 1],
    ['acknowledged and found 2', true, 2],
    ['not acknowledged', false, 0],
  ];
  test.each(matchedCountCases)(
    'should throw an error when %s items were found but nothing was modified',
    async (_caseName: string, acknowledged: boolean, matchedCount: number) => {
      const testObject: TestType = { id: '12345', foo: 'bar' };
      replaceOne.mockResolvedValue({
        acknowledged,
        matchedCount,
        modifiedCount: 0,
        upsertedCount: 0,
        upsertedId: null,
      });
      await expect(adapter.replaceOne(testQuery, testObject)).rejects.toThrow(
        `Failed to update document. Query matched ${matchedCount} items.`,
      );
    },
  );

  test('should return a single Id from replaceOne when upsert = true and no match was made', async () => {
    const testObject: TestType = { id: '12345', foo: 'bar' };
    const _id = 'mongoGeneratedId';

    replaceOne.mockResolvedValue({
      acknowledged: true,
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 1,
      upsertedId: _id,
    });

    const expected = {
      id: testObject.id,
      modifiedCount: 0,
      upsertedCount: 1,
    };

    const result = await adapter.replaceOne(testQuery, testObject, true);
    expect(result).toEqual(expected);
    expect(result).not.toEqual({ ...expected, id: _id });
  });

  const upsertFailureCases = [
    ['acknowledged but no matches', true, 0, 0, 0],
    ['acknowledged with a match and too many changes', true, 1, 1, 1],
    ['not acknowledged with not matches', false, 0, 0, 0],
  ];
  test.each(upsertFailureCases)(
    'should throw an error if upsert fails when %s',
    async (
      _caseName: string,
      acknowledged: boolean,
      matchedCount,
      modifiedCount,
      upsertedCount,
    ) => {
      const testObject: TestType = { id: '12345', foo: 'bar' };
      replaceOne.mockResolvedValue({
        acknowledged,
        matchedCount,
        modifiedCount,
        upsertedCount,
        upsertedId: null,
      });
      await expect(adapter.replaceOne(testQuery, testObject, true)).rejects.toThrow(
        'Failed to insert document into database.',
      );
    },
  );

  test('should return a single Id from insertOne', async () => {
    const id = '123456';
    insertOne.mockResolvedValue({ acknowledged: true, insertedId: id });
    const result = await adapter.insertOne({});
    expect(result.split('-').length).toEqual(5);
  });

  test('should throw an error if insertOne does not insert.', async () => {
    insertOne.mockResolvedValue({ acknowledged: false });
    await expect(adapter.insertOne({})).rejects.toThrow('Failed to insert document into database.');
  });

  test('should throw an error if updateOne does not match.', async () => {
    updateOne.mockResolvedValue({ acknowledged: true, matchedCount: undefined });
    await expect(adapter.updateOne(testQuery, {})).rejects.toThrow('No matching item found.');
  });

  test('should throw an error if updateOne does not update.', async () => {
    updateOne.mockResolvedValue({ acknowledged: false });
    await expect(adapter.updateOne(testQuery, {})).rejects.toThrow(
      'Failed to insert document into database.',
    );
  });

  test('should resolve if updateOne is successful.', async () => {
    const expectedResult = {
      matchedCount: 1,
      modifiedCount: 1,
    };

    updateOne.mockResolvedValue({ ...expectedResult, acknowledged: true });
    const result = await adapter.updateOne(testQuery, {});
    expect(result).toEqual(expectedResult);
  });

  test('should return a list of Ids from insertMany', async () => {
    const ids = ['0', '1', '2', '3', '4'];
    insertMany.mockResolvedValue({
      acknowledged: true,
      insertedIds: ids,
      insertedCount: ids.length,
    });
    const result = await adapter.insertMany([{}, {}, {}, {}, {}]);
    expect(result.length).toEqual(ids.length);
  });

  test('should return a count of 1 for 1 item deleted', async () => {
    deleteOne.mockResolvedValue({ acknowledged: true, deletedCount: 1 });
    const result = await adapter.deleteOne(testQuery);
    expect(result).toEqual(1);
  });

  const badDeleteCount = [0, 3];
  test.each(badDeleteCount)(
    'should throw NotFoundError if deleteOne returns a deletedCount of %s',
    async (deletedCount: number) => {
      deleteOne.mockResolvedValue({ acknowledged: true, deletedCount });
      await expect(adapter.deleteOne(testQuery)).rejects.toThrow(
        expect.objectContaining({
          status: 404,
          message: `Matched and deleted ${deletedCount} items.`,
          module: ADAPTER_MODULE_NAME,
        }),
      );
    },
  );

  test('should return a count of 5 for 5 items deleted', async () => {
    deleteMany.mockResolvedValue({ acknowledged: true, deletedCount: 5 });
    const result = await adapter.deleteMany(testQuery);
    expect(result).toEqual(5);
  });

  test('should throw NotFoundError if deleteMany returns a deletedCount of 0', async () => {
    deleteMany.mockResolvedValue({ acknowledged: true, deletedCount: 0 });
    await expect(adapter.deleteMany(testQuery)).rejects.toThrow(
      expect.objectContaining({
        status: 404,
        message: 'No items deleted',
        module: ADAPTER_MODULE_NAME,
      }),
    );
  });

  test('should return a count of 5 when countDocuments is called and there are 5 documents', async () => {
    countDocuments.mockResolvedValue(5);
    const result = await adapter.countDocuments(testQuery);
    expect(result).toEqual(5);
  });

  test('should return a count of 6 when countAllDocuments is called and there are 6 documents', async () => {
    countDocuments.mockResolvedValue(6);
    const result = await adapter.countAllDocuments();
    expect(result).toEqual(6);
  });

  test('should throw CamsError when some but not all items are inserted', async () => {
    insertMany.mockResolvedValue({
      acknowledged: true,
      insertedIds: {
        one: 'one',
        two: 'two',
        three: 'three',
      },
      insertedCount: 3,
    });

    await expect(async () => await adapter.insertMany([{}, {}, {}, {}])).rejects.toThrow(
      expect.objectContaining({
        status: 500,
        message: 'Not all items inserted',
        module: ADAPTER_MODULE_NAME,
      }),
    );
  });

  test('should handle errors', async () => {
    const originalError = new Error('Test Exception');
    const expectedError = expect.objectContaining({
      isCamsError: true,
      message: expect.any(String),
      camsStack: [
        expect.objectContaining({
          module: `${MODULE_NAME}_ADAPTER`,
          message: expect.any(String),
        }),
      ],
    });
    Object.values(spies).forEach((spy) => {
      spy.mockRejectedValue(originalError);
    });

    await expect(adapter.replaceOne(testQuery, {})).rejects.toThrow(expectedError);
    await expect(adapter.insertOne({})).rejects.toThrow(expectedError);
    await expect(adapter.insertMany([{}])).rejects.toThrow(expectedError);
    await expect(adapter.deleteOne(testQuery)).rejects.toThrow(expectedError);
    await expect(adapter.deleteMany(testQuery)).rejects.toThrow(expectedError);
    await expect(adapter.find(testQuery)).rejects.toThrow(expectedError);
    await expect(adapter.paginate(testQuery)).rejects.toThrow(expectedError);
    await expect(adapter.countDocuments(testQuery)).rejects.toThrow(expectedError);
    await expect(adapter.countAllDocuments()).rejects.toThrow(expectedError);
    await expect(adapter.findOne(testQuery)).rejects.toThrow(expectedError);
    await expect(adapter.getAll()).rejects.toThrow(expectedError);
  });
});
