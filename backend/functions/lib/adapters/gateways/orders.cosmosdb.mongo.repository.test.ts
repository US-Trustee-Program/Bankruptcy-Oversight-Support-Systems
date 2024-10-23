import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OrdersCosmosDbMongoRepository } from './orders.cosmosdb.mongo.repository';
import { ApplicationContext } from '../types/basic';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { TransferOrderAction } from '../../../../../common/src/cams/orders';

describe('orders repo', () => {
  let context: ApplicationContext;
  let repo: OrdersCosmosDbMongoRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = new OrdersCosmosDbMongoRepository(context);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (repo) await repo.close();
  });

  test('search function', async () => {
    const predicate = {
      divisionCodes: ['081'],
    };
    const orders = await repo.search(context, predicate);

    expect(orders).not.toBeNull();
    expect(orders.length).toBeGreaterThan(0);
  });

  test('should insert an array of transfer orders', async () => {
    const transfers = MockData.buildArray(MockData.getTransferOrder, 4);
    const expectedOrders = [...transfers];
    const actualOrders = await repo.createMany(context, expectedOrders);
    expect(actualOrders).toEqual(expectedOrders);
  });

  test('should get one order', async () => {
    const id = 'b2833fdb-110c-4a45-9a53-59b728243121';
    const result = await repo.read(context, id, 'some case id');
    expect(result).not.toBeNull();
  });

  test('should update one order', async () => {
    const id = '93ff688b-b865-4478-aa2f-e718de7116c5';
    const transferOrder = MockData.getTransferOrder();

    const result = await repo.update(context, id, transferOrder as TransferOrderAction);
    expect(result).not.toBeNull();
  });
});
