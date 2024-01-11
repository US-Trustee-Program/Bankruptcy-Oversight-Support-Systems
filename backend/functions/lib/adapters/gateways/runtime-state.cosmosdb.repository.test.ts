import { HumbleItem, HumbleQuery } from '../../testing/mock.cosmos-client-humble';
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

  test('should update a runtime state document', async () => {
    const replace = jest.spyOn(HumbleItem.prototype, 'replace');
    await repo.updateState(context, expected);
    expect(replace).toHaveBeenCalled();
  });

  test('should throw a ServerConfigError if AggregateAuthenticationError is encountered', async () => {
    const fetchAll = jest
      .spyOn(HumbleQuery.prototype, 'fetchAll')
      .mockImplementation(throwAggregateAuthenticationError<{ resources: OrderSyncState[] }>());
    await expect(repo.getState(context, 'ORDERS_SYNC_STATE')).rejects.toThrow(
      'Failed to authenticate to Azure',
    );
    expect(fetchAll).toHaveBeenCalled();

    const replace = jest
      .spyOn(HumbleItem.prototype, 'replace')
      .mockImplementation(throwAggregateAuthenticationError<void>());
    await expect(repo.updateState(context, expected)).rejects.toThrow(
      'Failed to authenticate to Azure',
    );
    expect(replace).toHaveBeenCalled();
  });

  test('should throw any other error encountered', async () => {
    const fetchAll = jest.spyOn(HumbleQuery.prototype, 'fetchAll').mockImplementation(() => {
      throw new Error('Some unknown error');
    });
    await expect(repo.getState(context, 'ORDERS_SYNC_STATE')).rejects.toThrow('Some unknown error');
    expect(fetchAll).toHaveBeenCalled();

    const replace = jest.spyOn(HumbleItem.prototype, 'replace').mockImplementation(() => {
      throw new Error('Some other unknown error');
    });
    await expect(repo.updateState(context, expected)).rejects.toThrow('Some other unknown error');
    expect(replace).toHaveBeenCalled();
  });
});
