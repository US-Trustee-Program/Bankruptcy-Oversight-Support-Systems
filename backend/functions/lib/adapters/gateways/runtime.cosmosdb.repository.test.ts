import { HumbleQuery } from '../../cosmos-humble-objects/fake.runtime.cosmos-client-humble';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OrderSyncState } from '../../use-cases/gateways.types';
import { RuntimeStateCosmosDbRepository } from './runtime.cosmosdb.repository';
import * as crypto from 'crypto';

describe('Runtime State Repo', () => {
  test('should get a state', async () => {
    const expected: OrderSyncState = {
      id: crypto.randomUUID().toString(),
      documentType: 'ORDERS_SYNC_STATE',
      txId: 0,
    };
    const mockRead = jest.spyOn(HumbleQuery.prototype, 'fetchAll').mockReturnValue({
      resources: [expected],
    });

    const context = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    const repo = new RuntimeStateCosmosDbRepository(context);
    const actual = await repo.getState(context, 'ORDERS_SYNC_STATE');

    expect(mockRead).toHaveBeenCalled();
    expect(actual).toEqual(expected);
  });
});
