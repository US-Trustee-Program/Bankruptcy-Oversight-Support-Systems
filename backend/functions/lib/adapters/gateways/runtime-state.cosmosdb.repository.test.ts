import { AggregateAuthenticationError } from '@azure/identity';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { MockHumbleItems, MockHumbleQuery } from '../../testing/mock.cosmos-client-humble';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OrderSyncState } from '../../use-cases/gateways.types';
import { ApplicationContext } from '../types/basic';
import { RuntimeStateCosmosDbRepository } from './runtime-state.cosmosdb.repository';
import * as crypto from 'crypto';

describe('Runtime State Repo', () => {
  const expected: OrderSyncState = {
    id: crypto.randomUUID().toString(),
    documentType: 'ORDERS_SYNC_STATE',
    txId: '0',
  };

  let context: ApplicationContext;
  let repo: RuntimeStateCosmosDbRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = new RuntimeStateCosmosDbRepository(context);
    jest.clearAllMocks();
  });

  test('should get a runtime state document', async () => {
    const fetchAll = jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: [expected],
    });
    const actual = await repo.getState(context, 'ORDERS_SYNC_STATE');
    expect(fetchAll).toHaveBeenCalled();
    expect(actual).toEqual(expected);
  });

  test('should throw an error if a runtime state document cannot be found or more than one is found', async () => {
    const fetchAll = jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: [],
    });
    await expect(repo.getState(context, 'ORDERS_SYNC_STATE')).rejects.toThrow(
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
    const actual = await repo.createState(context, toCreate);
    expect(create).toHaveBeenCalled();
    expect(actual.documentType).toEqual(toCreate.documentType);
    expect(actual.txId).toEqual(toCreate.txId);
  });

  test('should update a runtime state document', async () => {
    const stateToCreate = { ...expected };
    delete stateToCreate.id;
    const created = await repo.createState(context, stateToCreate);

    const upsert = jest.spyOn(MockHumbleItems.prototype, 'upsert');
    await repo.updateState(context, created);
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

    await expect(repo.getState(context, 'ORDERS_SYNC_STATE')).rejects.toThrow(serverConfigError);
    expect(fetchAllSpy).toHaveBeenCalled();
    await expect(repo.updateState(context, expected)).rejects.toThrow(serverConfigError);
    expect(upsertSpy).toHaveBeenCalled();
    await expect(repo.createState(context, expected)).rejects.toThrow(serverConfigError);
    expect(createSpy).toHaveBeenCalled();
  });

  test('should throw any other error encountered', async () => {
    const someError = new Error('Some other unknown error');
    const fetchAllSpy = jest
      .spyOn(MockHumbleQuery.prototype, 'fetchAll')
      .mockRejectedValue(someError);
    const upsertSpy = jest.spyOn(MockHumbleItems.prototype, 'upsert').mockRejectedValue(someError);
    const createSpy = jest.spyOn(MockHumbleItems.prototype, 'create').mockRejectedValue(someError);

    await expect(repo.getState(context, 'ORDERS_SYNC_STATE')).rejects.toThrow(someError);
    expect(fetchAllSpy).toHaveBeenCalled();
    await expect(repo.updateState(context, expected)).rejects.toThrow(someError);
    expect(upsertSpy).toHaveBeenCalled();
    await expect(repo.createState(context, expected)).rejects.toThrow(someError);
    expect(createSpy).toHaveBeenCalled();
  });
});
