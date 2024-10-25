import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OrderSyncState } from '../../use-cases/gateways.types';
import { ApplicationContext } from '../types/basic';
import { RuntimeStateCosmosMongoDbRepository } from './runtime-state.cosmosdb.mongo.repository';
import * as crypto from 'crypto';
import { MongoCollectionAdapter } from './mongo/mongo-adapter';
import { CamsError } from '../../common-errors/cams-error';
import { closeDeferred } from '../../defer-close';
import { UnknownError } from '../../common-errors/unknown-error';

describe('Runtime State Repo', () => {
  const expected: OrderSyncState = {
    id: crypto.randomUUID().toString(),
    documentType: 'ORDERS_SYNC_STATE',
    txId: '0',
  };
  let context: ApplicationContext;
  let repo: RuntimeStateCosmosMongoDbRepository<OrderSyncState>;
  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = new RuntimeStateCosmosMongoDbRepository(context);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await closeDeferred(context);
  });

  test('should get a runtime state document', async () => {
    const find = jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([expected]);
    const actual = await repo.read('ORDERS_SYNC_STATE');
    expect(find).toHaveBeenCalled();
    expect(actual).toEqual(expected);
  });

  test('should throw an error if a runtime state document cannot be found or more than one is found', async () => {
    const find = jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);
    const expectedError = new CamsError('', {
      message: 'Initial state was not found or was ambiguous.',
    });
    await expect(repo.read('ORDERS_SYNC_STATE')).rejects.toThrow(expectedError);
    expect(find).toHaveBeenCalled();
  });

  test('should upsert a runtime state document', async () => {
    const replaceOne = jest
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockImplementation((_resource) => {
        return Promise.resolve(expected.id);
      });
    const toCreate = { ...expected };
    delete toCreate.id;
    await repo.upsert(toCreate);
    expect(replaceOne).toHaveBeenCalledWith(expect.anything(), expect.anything(), true);
    // expect(actual.documentType).toEqual(expected.documentType);
  });

  test('should update a runtime state document', async () => {
    const stateToCreate = { ...expected };
    delete stateToCreate.id;
    jest.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockImplementation((_resource) => {
      return Promise.resolve(expected.id);
    });
    const replaceOne = jest
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockImplementation((_resource) => {
        return Promise.resolve(expected.id);
      });
    await repo.upsert(stateToCreate);

    await repo.upsert(stateToCreate);
    expect(replaceOne).toHaveBeenCalled();
  });

  test('should throw any other error encountered', async () => {
    const someError = new Error('Some other unknown error');
    const findSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockRejectedValue(someError);
    const replaceSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockRejectedValue(someError);

    const expectedError = new UnknownError(expect.anything(), { originalError: someError });

    await expect(repo.read('ORDERS_SYNC_STATE')).rejects.toThrow(expectedError);
    expect(findSpy).toHaveBeenCalled();
    await expect(repo.upsert(expected)).rejects.toThrow(expectedError);
    expect(replaceSpy).toHaveBeenCalled();
  });
});
