import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OrdersCosmosDbMongoRepository } from './orders.cosmosdb.mongo.repository';
import { ApplicationContext } from '../types/basic';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { TransferOrderAction } from '../../../../../common/src/cams/orders';

describe.skip('orders repo', () => {
  let context: ApplicationContext;
  let repo: OrdersCosmosDbMongoRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = new OrdersCosmosDbMongoRepository(context.config.cosmosConfig.mongoDbConnectionString);
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

    console.log(orders);
    expect(orders).not.toBeNull();
    expect(orders.length).toBeGreaterThan(0);
  });

  test('should get one order', async () => {
    const transfers = MockData.buildArray(MockData.getTransferOrder, 4);
    const consolidations = MockData.buildArray(MockData.getConsolidationOrder, 4);
    const result = repo.putOrders(context, [...transfers, ...consolidations]);
    expect(result).toEqual([]);
  });

  test('should insert an order', async () => {
    const transfers = MockData.buildArray(MockData.getTransferOrder, 4);
    const consolidations = MockData.buildArray(MockData.getConsolidationOrder, 4);
    const result = repo.putOrders(context, [...transfers, ...consolidations]);
    expect(result).toEqual([]);
  });

  test('should get one order', async () => {
    const id = '6711336063a44b1ca097c8fj';
    const result = await repo.getOrder(context, id, 'some case id');
    expect(result).not.toBeNull();
  });

  test.only('should update one order', async () => {
    const id = '93ff688b-b865-4478-aa2f-e718de7116c5';
    const transferOrder = MockData.getTransferOrder();

    const result = await repo.updateOrder(context, id, transferOrder as TransferOrderAction);
    expect(result).not.toBeNull();
  });
});
