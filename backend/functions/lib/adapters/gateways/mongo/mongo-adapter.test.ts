import { MongoCollectionAdapter } from './mongo-adapter';
import QueryBuilder from '../../../query/query-builder';
import { toMongoQuery } from '../../../query/mongo-query-renderer';
import { CollectionHumble } from '../../../humble-objects/mongo-humble';
import { UnknownError } from '../../../common-errors/unknown-error';

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
  const testQuery = QueryBuilder.build(toMongoQuery, and());
  const humbleCollection = spies as unknown as CollectionHumble<TestType>;
  const adapter = new MongoCollectionAdapter<TestType>(MODULE_NAME, humbleCollection);

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('should return a list of items from a find', async () => {});

  test('should return a and empty list of items if', async () => {});

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
    await expect(adapter.findOne(testQuery)).rejects.toThrow(expectedError);
    await expect(adapter.countDocuments(testQuery)).rejects.toThrow(expectedError);
  });
});
