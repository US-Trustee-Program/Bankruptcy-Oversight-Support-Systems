import { OrdersCosmosDbRepository } from './orders.cosmosdb.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../types/basic';
import {
  FakeOrdersCosmosClientHumbleAuthErrorDuringFetch,
  //FakeOrdersCosmosClientHumbleUnknownErrorDuringFetch,
} from '../../cosmos-humble-objects/fake.orders.cosmos-client-humble';
//import { THROW_PERMISSIONS_ERROR_CASE_ID } from '../../testing/testing-constants';

jest.mock('./cosmos-humble-objects/fake.orders.cosmos-client-humble', () => {
  return jest.fn().mockImplementation(() => {
    return FakeOrdersCosmosClientHumbleAuthErrorDuringFetch;
  });
});

describe('Test case assignment cosmosdb repository tests', () => {
  let repository: OrdersCosmosDbRepository;
  let applicationContext: ApplicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    repository = new OrdersCosmosDbRepository(applicationContext);
  });

  test('Should throw ServerConfigError if an AggregateAuthenticationError error occurs when fetching all orders', async () => {
    await expect(async () => {
      await repository.getOrders(applicationContext);
    }).rejects.toThrow(`Failed to authenticate to Azure`);
  });
});
