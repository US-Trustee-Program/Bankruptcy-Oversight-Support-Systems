import { MongoCollectionAdapter } from './mongo-adapter';
import QueryBuilder from '../../../query/query-builder';
import { CollectionHumble } from '../../../humble-objects/mongo-humble';
import { UnknownError } from '../../../common-errors/unknown-error';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { CamsError } from '../../../common-errors/cams-error';

const { and } = QueryBuilder;

const MODULE_NAME = 'TEST_ADAPTER';

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
  id: string;
  name: string;
};

describe('Mongo adapter', () => {
  const testQuery = QueryBuilder.build(and());
  const humbleCollection = spies as unknown as CollectionHumble<TestType>;
  const adapter = new MongoCollectionAdapter<TestType>(MODULE_NAME, humbleCollection);

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('should return a list of items from a find', async () => {
    find.mockResolvedValue([{}, {}, {}]);
    const item = await adapter.find(testQuery);
    expect(item).toEqual([{}, {}, {}]);
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

  test('should return a single Id from a replaceOne', async () => {
    const id = '123456';
    replaceOne.mockResolvedValue({ acknowdledged: true, upsertedId: id });
    const result = await adapter.replaceOne(testQuery, {});
    expect(result).toEqual(id);
  });

  test('should return a single Id from insertOne', async () => {
    const id = '123456';
    insertOne.mockResolvedValue({ acknowdledged: true, insertedId: id });
    const result = await adapter.insertOne({});
    expect(result).toEqual(id);
  });

  test('should return a list of Ids from insertMany', async () => {
    const ids = ['0', '1', '2', '3', '4'];
    insertMany.mockResolvedValue({ acknowdledged: true, insertedIds: ids });
    const result = await adapter.insertMany([{}, {}, {}, {}, {}]);
    expect(result).toEqual(ids);
  });

  test('should return a count of 1 for 1 item deleted', async () => {
    deleteOne.mockResolvedValue({ acknowdledged: true, deletedCount: 1 });
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
    deleteMany.mockResolvedValue({ acknowdledged: true, deletedCount: 5 });
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

  test('should throw CamsError when some but not all items are inserted', async () => {
    insertMany.mockResolvedValue({
      insertedIds: {
        one: 'one',
        two: 'one',
        three: 'one',
      },
    });
    try {
      await adapter.insertMany([{}, {}, {}, {}]);
      expect(true).toBeFalsy();
    } catch (e) {
      const expectedData = ['one', 'two', 'three'];
      expect(e).toEqual(
        new CamsError(MODULE_NAME, {
          message: 'Not all items inserted',
          data: expectedData,
        }),
      );
      expect(e.data).toEqual(expectedData);
    }
  });

  test('should handle acknowledged == false', async () => {
    const response = { acknowledged: false };
    const error = new UnknownError(MODULE_NAME, {
      message: 'Operation returned Not Acknowledged.',
    });
    Object.values(spies).forEach((spy) => {
      spy.mockResolvedValue(response);
    });

    await expect(adapter.replaceOne(testQuery, {})).rejects.toThrow(error);
    await expect(adapter.insertOne({})).rejects.toThrow(error);
    await expect(adapter.insertMany([{}])).rejects.toThrow(error);
    await expect(adapter.deleteOne(testQuery)).rejects.toThrow(error);
    await expect(adapter.deleteMany(testQuery)).rejects.toThrow(error);
  });

  test('should handle errors', async () => {
    const originalError = new Error('Test Exception');
    const expectedError = new UnknownError(MODULE_NAME, { originalError });
    Object.values(spies).forEach((spy) => {
      spy.mockRejectedValue(expectedError);
    });

    await expect(adapter.replaceOne(testQuery, {})).rejects.toThrow(expectedError);
    await expect(adapter.insertOne({})).rejects.toThrow(expectedError);
    await expect(adapter.insertMany([{}])).rejects.toThrow(expectedError);
    await expect(adapter.deleteOne(testQuery)).rejects.toThrow(expectedError);
    await expect(adapter.deleteMany(testQuery)).rejects.toThrow(expectedError);
    await expect(adapter.find(testQuery)).rejects.toThrow(expectedError);
    await expect(adapter.countDocuments(testQuery)).rejects.toThrow(expectedError);
    await expect(adapter.findOne(testQuery)).rejects.toThrow(expectedError);
  });
});
