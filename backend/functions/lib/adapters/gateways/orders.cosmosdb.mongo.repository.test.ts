import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OrdersCosmosDbMongoRepository } from './orders.cosmosdb.mongo.repository';
import { ApplicationContext } from '../types/basic';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { TransferOrderAction } from '../../../../../common/src/cams/orders';
import { MongoCollectionAdapter } from './mongo/mongo-adapter';
import QueryBuilder from '../../query/query-builder';
import { closeDeferred } from '../../defer-close';

describe('orders repo', () => {
  let context: ApplicationContext;
  let repo: OrdersCosmosDbMongoRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = new OrdersCosmosDbMongoRepository(context);
    jest.clearAllMocks();
  });

  // TODO: Make sure each repo test has this following `afterEach`:
  afterEach(async () => {
    closeDeferred(context);
  });

  test('search function', async () => {
    const predicate = {
      divisionCodes: ['081'],
    };
    const orders = await repo.search(predicate);

    expect(orders).not.toBeNull();
    expect(orders.length).toBeGreaterThan(0);
  });

  test('should insert an array of transfer orders', async () => {
    const commonTestId = 'testId';
    const transfers = MockData.buildArray(MockData.getTransferOrder, 4);
    const expectedOrders = [...transfers].map((order) => {
      return { ...order, id: commonTestId };
    });
    jest
      .spyOn(MongoCollectionAdapter.prototype, 'insertMany')
      .mockResolvedValue(expectedOrders.map((order) => order.id));
    const actualOrders = await repo.createMany(expectedOrders);
    expect(actualOrders).toEqual(expectedOrders);
  });

  test('should get one order', async () => {
    const expected = MockData.getTransferOrder();
    jest.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(expected);
    const actual = await repo.read(expected.id);
    expect(actual).toEqual(expected);
  });

  test('should update one order', async () => {
    const existing = MockData.getTransferOrder({
      override: { docketSuggestedCaseNumber: undefined },
    });
    const expected: TransferOrderAction = {
      ...existing,
      newCase: MockData.getCaseSummary(),
      orderType: 'transfer',
      status: 'approved',
    };
    jest.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(existing);
    const replaceOne = jest
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockResolvedValue(undefined);
    await repo.update(expected);
    expect(replaceOne).toHaveBeenCalledWith(QueryBuilder.equals('id', existing.id), expected);
  });
});
