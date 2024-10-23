import { MongoCollectionAdapter } from './mongo-adapter';
import QueryBuilder from '../../../query/query-builder';
import { toMongoQuery } from '../../../query/mongo-query-renderer';
import { CollectionHumble } from '../../../humble-objects/mongo-humble';
import { Collection, Db } from 'mongodb';
import { UnknownError } from '../../../common-errors/unknown-error';

const { and } = QueryBuilder;

const find = jest.fn();
const findOne = jest.fn();
const replaceOne = jest.fn().mockImplementation(() => {
  console.log('We executed the original mock.');
  throw new Error('hello');
});
const insertOne = jest.fn();
const insertMany = jest.fn();
const deleteOne = jest.fn();
const deleteMany = jest.fn();
const countDocuments = jest.fn();

const spies = {
  collection: {} as Collection,
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
  let adapter: MongoCollectionAdapter<TestType>;
  const humbleDb = { name: 'testDb', collection: jest.fn() } as unknown as Db;
  const collectionHumble = spies as unknown as CollectionHumble<TestType>;

  beforeAll(() => {
    adapter = new MongoCollectionAdapter<TestType>('TEST_ADAPTER', collectionHumble);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('should return a list of items from a find', async () => {});

  test('should return a and empty list of items if', async () => {});

  test.only('should handle acknowledged == false', async () => {
    const response = { acknowledged: false };
    // spies.forEach((spy) => {
    //   spy.mockResolvedValue(response);
    // });

    // const insertOne = jest.spyOn(CollectionHumble.prototype, 'insertOne');
    // const insertMany = jest.spyOn(CollectionHumble.prototype, 'insertMany');
    // const deleteOne = jest.spyOn(CollectionHumble.prototype, 'deleteOne');
    // const deleteMany = jest.spyOn(CollectionHumble.prototype, 'deleteMany');
    // const countDocuments = jest.spyOn(CollectionHumble.prototype, 'countDocuments');

    replaceOne.mockResolvedValue(response);
    await replaceOne();
    await adapter.replaceOne(testQuery, {});
    await expect(adapter.replaceOne(testQuery, {})).rejects.toThrow();
    // await adapter.insertOne({});
    // await adapter.insertMany([{}]);
    // await adapter.deleteOne(testQuery);
    // await adapter.deleteMany(testQuery);
  });

  test.skip('should handle errors', async () => {
    const error = new Error('Test Exception');
    // spies.forEach((spy) => {
    //   spy.mockImplementation(() => Promise.reject(error));
    // });
    await expect(adapter.replaceOne(testQuery, {})).rejects.toThrow(error);
    // expect(await adapter.insertOne({})).rejects.toThrow(error);
    // expect(await adapter.insertMany([{}])).rejects.toThrow(error);
    // expect(await adapter.deleteOne(testQuery)).rejects.toThrow(error);
    // expect(await adapter.deleteMany(testQuery)).rejects.toThrow(error);
    // expect(await adapter.find(testQuery)).rejects.toThrow(error);
    // expect(await adapter.findOne(testQuery)).rejects.toThrow(error);
    // expect(await adapter.countDocuments(testQuery)).rejects.toThrow(error);
  });
});
