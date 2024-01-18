import { ServerConfigError } from '../../common-errors/server-config-error';
import { HumbleItem, HumbleItems, HumbleQuery } from '../../testing/mock.cosmos-client-humble';
import { throwAggregateAuthenticationError } from '../../testing/mock.cosmos-client-humble.helpers';
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
    context = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    repo = new RuntimeStateCosmosDbRepository(context);
    jest.clearAllMocks();
  });

  test('should get a runtime state document', async () => {
    const fetchAll = jest.spyOn(HumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: [expected],
    });
    const actual = await repo.getState(context, 'ORDERS_SYNC_STATE');
    expect(fetchAll).toHaveBeenCalled();
    expect(actual).toEqual(expected);
  });

  test('should throw an error if a runtime state document cannot be found or more than one is found', async () => {
    const fetchAll = jest.spyOn(HumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: [],
    });
    await expect(repo.getState(context, 'ORDERS_SYNC_STATE')).rejects.toThrow(
      'Initial state was not found or was ambiguous.',
    );
    expect(fetchAll).toHaveBeenCalled();
  });

  test('should create a runtime state document', async () => {
    const create = jest.spyOn(HumbleItems.prototype, 'create').mockResolvedValue({
      resource: expected,
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

    const replace = jest.spyOn(HumbleItem.prototype, 'replace');
    await repo.updateState(context, created);
    expect(replace).toHaveBeenCalled();
  });

  test('should throw a ServerConfigError if AggregateAuthenticationError is encountered', async () => {
    const serverConfigError = new ServerConfigError('TEST', {
      message: 'Failed to authenticate to Azure',
    });
    jest
      .spyOn(HumbleQuery.prototype, 'fetchAll')
      .mockImplementation(throwAggregateAuthenticationError<{ resources: OrderSyncState[] }>());

    jest
      .spyOn(HumbleItem.prototype, 'replace')
      .mockImplementation(throwAggregateAuthenticationError());

    jest
      .spyOn(HumbleItems.prototype, 'create')
      .mockImplementation(throwAggregateAuthenticationError<void>());

    await expect(repo.getState(context, 'ORDERS_SYNC_STATE')).rejects.toThrow(serverConfigError);
    await expect(repo.updateState(context, expected)).rejects.toThrow(serverConfigError);
    await expect(repo.createState(context, expected)).rejects.toThrow(serverConfigError);
  });

  test('should throw any other error encountered', async () => {
    const someError = new Error('Some other unknown error');
    jest.spyOn(HumbleQuery.prototype, 'fetchAll').mockRejectedValue(someError);
    jest.spyOn(HumbleItem.prototype, 'replace').mockRejectedValue(someError);
    jest.spyOn(HumbleItems.prototype, 'create').mockRejectedValue(someError);

    await expect(repo.getState(context, 'ORDERS_SYNC_STATE')).rejects.toThrow(someError);
    await expect(repo.updateState(context, expected)).rejects.toThrow(someError);
    await expect(repo.createState(context, expected)).rejects.toThrow(someError);
  });
});
