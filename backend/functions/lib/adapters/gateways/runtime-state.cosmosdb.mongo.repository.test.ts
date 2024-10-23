import { AggregateAuthenticationError } from '@azure/identity';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { MockHumbleItems, MockHumbleQuery } from '../../testing/mock.cosmos-client-humble';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OrderSyncState } from '../../use-cases/gateways.types';
import { ApplicationContext } from '../types/basic';
import { RuntimeStateCosmosMongoDbRepository } from './runtime-state.cosmosdb.mongo.repository';
import * as crypto from 'crypto';
import { CollectionHumble } from '../../humble-objects/mongo-humble';
import { FindCursor } from 'mongodb';
import { Order } from '../../../../../common/src/cams/orders';

describe('Runtime State Repo', () => {
  const expected: OrderSyncState = {
    id: crypto.randomUUID().toString(),
    documentType: 'ORDERS_SYNC_STATE',
    txId: '0',
  };
  const findCursor: FindCursor<OrderSyncState> = expected;
  let context: ApplicationContext;
  let repo: RuntimeStateCosmosMongoDbRepository;
  function toFindCursor(obj: object) {
    const cursor = new FindCursor<OrderSyncState>();
  }
  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = new RuntimeStateCosmosMongoDbRepository(context);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (repo) await repo.close();
  });
  test('should get a runtime state document', async () => {
    const fetchAll = jest.spyOn(CollectionHumble.prototype, 'find').mockResolvedValue([expected]);
    const actual = await repo.read(context, 'ORDERS_SYNC_STATE');
    expect(fetchAll).toHaveBeenCalled();
    expect(actual).toEqual(expected);
  });

  test('should throw an error if a runtime state document cannot be found or more than one is found', async () => {
    const fetchAll = jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: [],
    });
    await expect(await repo.read(context, 'ORDERS_SYNC_STATE')).rejects.toThrow(
      'Initial state was not found or was ambiguous.',
    );
    expect(fetchAll).toHaveBeenCalled();
  });

  test('should create a runtime state document', async () => {
    const create = jest
      .spyOn(MockHumbleItems.prototype, 'create')
      .mockImplementation((_resource) => {
        return Promise.resolve({
          resource: expected,
        });
      });
    const toCreate = { ...expected };
    delete toCreate.id;
    const actualId = await repo.create(context, toCreate);
    console.log(actualId);
    expect(create).toHaveBeenCalled();
    expect(actualId).toEqual(toCreate.id);
  });

  test('should update a runtime state document', async () => {
    const stateToCreate = { ...expected };
    delete stateToCreate.id;
    const createdId = await repo.create(context, stateToCreate);

    const upsert = jest.spyOn(MockHumbleItems.prototype, 'upsert');
    await repo.update(context, createdId, stateToCreate);
    expect(upsert).toHaveBeenCalled();
  });

  test('should throw a ServerConfigError if AggregateAuthenticationError is encountered', async () => {
    const cosmosdbAggregateError = new AggregateAuthenticationError([], 'Mocked Test Error');
    const serverConfigError = new ServerConfigError('TEST', {
      message: 'Failed to authenticate to Azure',
      originalError: cosmosdbAggregateError,
    });
    const fetchAllSpy = jest
      .spyOn(MockHumbleQuery.prototype, 'fetchAll')
      .mockRejectedValue(cosmosdbAggregateError);
    const upsertSpy = jest
      .spyOn(MockHumbleItems.prototype, 'upsert')
      .mockRejectedValue(cosmosdbAggregateError);
    const createSpy = jest
      .spyOn(MockHumbleItems.prototype, 'create')
      .mockRejectedValue(cosmosdbAggregateError);

    await expect(repo.read(context, 'ORDERS_SYNC_STATE')).rejects.toThrow(serverConfigError);
    expect(fetchAllSpy).toHaveBeenCalled();
    await expect(repo.update(context, expected.id, expected)).rejects.toThrow(serverConfigError);
    expect(upsertSpy).toHaveBeenCalled();
    await expect(repo.create(context, expected)).rejects.toThrow(serverConfigError);
    expect(createSpy).toHaveBeenCalled();
  });

  test('should throw any other error encountered', async () => {
    const someError = new Error('Some other unknown error');
    const fetchAllSpy = jest
      .spyOn(MockHumbleQuery.prototype, 'fetchAll')
      .mockRejectedValue(someError);
    const upsertSpy = jest.spyOn(MockHumbleItems.prototype, 'upsert').mockRejectedValue(someError);
    const createSpy = jest.spyOn(MockHumbleItems.prototype, 'create').mockRejectedValue(someError);

    await expect(repo.read(context, 'ORDERS_SYNC_STATE')).rejects.toThrow(someError);
    expect(fetchAllSpy).toHaveBeenCalled();
    await expect(repo.update(context, expected.id, expected)).rejects.toThrow(someError);
    expect(upsertSpy).toHaveBeenCalled();
    await expect(repo.create(context, expected)).rejects.toThrow(someError);
    expect(createSpy).toHaveBeenCalled();
  });
});
