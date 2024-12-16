import { CamsError } from '../../../../common-errors/cams-error';
import { NotFoundError } from '../../../../common-errors/not-found-error';
import { UnknownError } from '../../../../common-errors/unknown-error';
import { CollectionHumble, DocumentClient } from '../../../../humble-objects/mongo-humble';
import QueryBuilder from '../../../../query/query-builder';
import { MongoCollectionAdapter, removeIds } from './mongo-adapter';

const { and, orderBy } = QueryBuilder;

const MODULE_NAME = 'TEST_MODULE';

const find = jest.fn();
const findOne = jest.fn();
const replaceOne = jest.fn();
const insertOne = jest.fn();
const insertMany = jest.fn();
const deleteOne = jest.fn();
const deleteMany = jest.fn();
const countDocuments = jest.fn();

const spies = {
  find,
  findOne,
  replaceOne,
  insertOne,
  insertMany,
  deleteOne,
  deleteMany,
  countDocuments,
};

type TestType = {
  _id?: unknown;
  id?: string;
  foo?: string;
};

describe('Mongo adapter', () => {
  const testQuery = QueryBuilder.build(and());
  const humbleCollection = spies as unknown as CollectionHumble<TestType>;
  const adapter = new MongoCollectionAdapter<TestType>(MODULE_NAME, humbleCollection);

  afterEach(() => {
    jest.resetAllMocks();
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
    const sort = jest.fn().mockImplementation(generator);
    find.mockResolvedValue({ sort });
    const item = await adapter.getAll(orderBy(['name', 'ASCENDING']));
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
    const sort = jest.fn().mockImplementation(generator);
    find.mockResolvedValue({ sort });
    const item = await adapter.find(testQuery, orderBy(['name', 'ASCENDING']));
    expect(item).toEqual([{}, {}, {}]);
    expect(find).toHaveBeenCalled();
    expect(sort).toHaveBeenCalled();
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
      new NotFoundError(expect.anything(), { message: 'No matching item found.' }),
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
    });
    const result = await adapter.replaceOne(testQuery, testObject);
    expect(result).not.toEqual(_id);
    expect(result).toEqual(testObject.id);
  });

  test('should throw an error calling replaceOne for a nonexistent record and upsert=false', async () => {
    const testObject: TestType = { id: '12345', foo: 'bar' };
    replaceOne.mockResolvedValue({
      acknowledged: false,
      matchedCount: 0,
      modifiedCount: 0,
      upsertedId: null,
    });
    await expect(adapter.replaceOne(testQuery, testObject)).rejects.toThrow(
      'No matching item found.',
    );
  });

  test('should return a single Id from replaceOne when upsert = true', async () => {
    const testObject: TestType = { id: '12345', foo: 'bar' };
    const _id = 'mongoGeneratedId';

    replaceOne.mockResolvedValue({
      acknowledged: true,
      matchedCount: 0,
      modifiedCount: 1,
      upsertedId: _id,
    });
    const result = await adapter.replaceOne(testQuery, testObject, true);
    expect(result).toEqual(testObject.id);
    expect(result).not.toEqual(_id);
  });

  test('should throw an error if replaceOne does not match.', async () => {
    const testObject: TestType = { id: '12345', foo: 'bar' };
    replaceOne.mockResolvedValue({
      acknowledged: false,
      matchedCount: 0,
      modifiedCount: 0,
      upsertedId: null,
    });
    await expect(adapter.replaceOne(testQuery, testObject, true)).rejects.toThrow(
      'Failed to insert document into database.',
    );
  });

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

  test('should throw NotFoundError if deleteOne returns a deletedCount of 0', async () => {
    deleteOne.mockResolvedValue({ acknowledged: true, deletedCount: 0 });
    await expect(adapter.deleteOne(testQuery)).rejects.toThrow(
      new NotFoundError(MODULE_NAME, { message: 'No items deleted' }),
    );
  });

  test('should return a count of 5 for 5 items deleted', async () => {
    deleteMany.mockResolvedValue({ acknowledged: true, deletedCount: 5 });
    const result = await adapter.deleteMany(testQuery);
    expect(result).toEqual(5);
  });

  test('should throw NotFoundError if deleteMany returns a deletedCount of 0', async () => {
    deleteMany.mockResolvedValue({ acknowledged: true, deletedCount: 0 });
    await expect(adapter.deleteMany(testQuery)).rejects.toThrow(
      new NotFoundError(MODULE_NAME, { message: 'No items deleted' }),
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

    const error = new CamsError(MODULE_NAME, {
      message: 'Not all items inserted',
      data: expect.anything(),
    });

    expect(async () => await adapter.insertMany([{}, {}, {}, {}])).rejects.toThrow(error);
  });

  test('should handle errors', async () => {
    const originalError = new Error('Test Exception');
    const expectedError = new UnknownError(MODULE_NAME, {
      originalError,
      camsStackInfo: { message: expect.any(String), module: 'MODULE_NAME' },
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
    await expect(adapter.countDocuments(testQuery)).rejects.toThrow(expectedError);
    await expect(adapter.countAllDocuments()).rejects.toThrow(expectedError);
    await expect(adapter.findOne(testQuery)).rejects.toThrow(expectedError);
    await expect(adapter.getAll()).rejects.toThrow(expectedError);
  });
});
