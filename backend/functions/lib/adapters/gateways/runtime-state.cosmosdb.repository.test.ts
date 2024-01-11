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
    txId: 0,
  };

  let context: ApplicationContext;
  let repo: RuntimeStateCosmosDbRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    repo = new RuntimeStateCosmosDbRepository(context);
    jest.clearAllMocks();
  });

  test('should get a runtime state document', async () => {
    const fetchAll = jest.spyOn(HumbleQuery.prototype, 'fetchAll').mockReturnValue({
      resources: [expected],
    });
    const actual = await repo.getState(context, 'ORDERS_SYNC_STATE');
    expect(fetchAll).toHaveBeenCalled();
    expect(actual).toEqual(expected);
  });

  test('should throw an error if a runtime state document cannot be found or more than one is found', async () => {
    const fetchAll = jest.spyOn(HumbleQuery.prototype, 'fetchAll').mockReturnValue({
      resources: [],
    });
    await expect(repo.getState(context, 'ORDERS_SYNC_STATE')).rejects.toThrow(
      'Initial state was not found or was ambiguous.',
    );
    expect(fetchAll).toHaveBeenCalled();
  });

  test('should create a runtime state document', async () => {
    const create = jest.spyOn(HumbleItems.prototype, 'create').mockReturnValue({
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
    const replace = jest.spyOn(HumbleItem.prototype, 'replace');
    await repo.updateState(context, expected);
    expect(replace).toHaveBeenCalled();
  });

  test('should throw a ServerConfigError if AggregateAuthenticationError is encountered', async () => {
    const authErrorMessage = 'Failed to authenticate to Azure';

    const fetchAll = jest
      .spyOn(HumbleQuery.prototype, 'fetchAll')
      .mockImplementation(throwAggregateAuthenticationError<{ resources: OrderSyncState[] }>());
    await expect(repo.getState(context, 'ORDERS_SYNC_STATE')).rejects.toThrow(authErrorMessage);
    expect(fetchAll).toHaveBeenCalled();

    const replace = jest
      .spyOn(HumbleItem.prototype, 'replace')
      .mockImplementation(throwAggregateAuthenticationError<void>());
    await expect(repo.updateState(context, expected)).rejects.toThrow(authErrorMessage);
    expect(replace).toHaveBeenCalled();

    const create = jest
      .spyOn(HumbleItems.prototype, 'create')
      .mockImplementation(throwAggregateAuthenticationError<void>());
    await expect(repo.createState(context, expected)).rejects.toThrow(authErrorMessage);
    expect(create).toHaveBeenCalled();
  });

  test('should throw any other error encountered', async () => {
    const someError = new Error('Some other unknown error');
    const throwErrorFn = () => {
      throw someError;
    };

    const fetchAll = jest.spyOn(HumbleQuery.prototype, 'fetchAll').mockImplementation(throwErrorFn);
    await expect(repo.getState(context, 'ORDERS_SYNC_STATE')).rejects.toThrow(someError.message);
    expect(fetchAll).toHaveBeenCalled();

    const replace = jest.spyOn(HumbleItem.prototype, 'replace').mockImplementation(throwErrorFn);
    await expect(repo.updateState(context, expected)).rejects.toThrow(someError.message);
    expect(replace).toHaveBeenCalled();

    const create = jest.spyOn(HumbleItems.prototype, 'create').mockImplementation(throwErrorFn);
    await expect(repo.createState(context, expected)).rejects.toThrow(someError.message);
    expect(create).toHaveBeenCalled();
  });
});
