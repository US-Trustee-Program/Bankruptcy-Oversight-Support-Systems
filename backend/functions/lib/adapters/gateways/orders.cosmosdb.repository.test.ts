import { OrdersCosmosDbRepository } from './orders.cosmosdb.repository';
import { ORDERS } from '../../testing/mock-data/orders.mock';
import { Order, OrderTransfer } from '../../use-cases/orders/orders.model';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../types/basic';
import FakeOrdersCosmosClientHumble from '../../cosmos-humble-objects/fake.orders.cosmos-client-humble';
import { THROW_PERMISSIONS_ERROR_CASE_ID } from '../../testing/testing-constants';

const testNewOrderTransferData: OrderTransfer = {
  id: 'test-id-0',
  sequenceNumber: '2',
  caseId: '111-11-11111',
  newCaseId: '000-01-12345',
  newCourtName: 'New Court Name',
  newCourtDivisionName: 'New Division',
  status: 'approved',
};

const testNewOrderData: Order = {
  id: 'test-id-0',
  caseId: '111-11-11111',
  caseTitle: 'Foreign Business Entity',
  chapter: '15',
  courtName: 'Southern District of New York',
  courtDivisionName: 'Manhattan',
  regionId: '02',
  orderType: 'transfer',
  orderDate: '2023-11-02',
  status: 'pending',
  newCaseId: '012-34-56789',
  sequenceNumber: 100,
  dateFiled: '2023-11-02',
  summaryText: 'Order to Transfer',
  fullText: 'It is ordered that the case be transferred...',
};

describe('Test case assignment cosmosdb repository tests', () => {
  let repository: OrdersCosmosDbRepository;
  let applicationContext: ApplicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    repository = new OrdersCosmosDbRepository(applicationContext);
  });

  test('Should get a list of orders', async () => {
    const testResult = await repository.getOrders(applicationContext);
    expect(testResult).toEqual(ORDERS);
  });

  test('When updating an order, Should throw Unknown Error if an unknown error occurs', async () => {
    const errorTestNewOrderTransferData: OrderTransfer = {
      ...testNewOrderTransferData,
      id: 'error-id',
    };

    await expect(
      repository.updateOrder(applicationContext, errorTestNewOrderTransferData),
    ).rejects.toThrow(`Order not found with id error-id`);
  });

  test('Should update order and return a cosmos order id', async () => {
    const testResult = await repository.updateOrder(applicationContext, testNewOrderTransferData);
    expect(testResult).toEqual({ id: 'test-id-0' });
  });

  test('When putting an order, Should throw Unknown Error if an unknown error occurs', async () => {
    const errorTestNewOrderData: Order = {
      ...testNewOrderData,
    };
    delete errorTestNewOrderData.id;

    await expect(repository.putOrders(applicationContext, [errorTestNewOrderData])).rejects.toThrow(
      `unique key violation`,
    );
  });

  test('When putting an order, Should throw ServerConfigError if an AggregateAuthenticationError error occurs', async () => {
    const testNewOrderData2: Order = {
      ...testNewOrderData,
      caseId: THROW_PERMISSIONS_ERROR_CASE_ID,
    };
    delete testNewOrderData2.id;
    const ordersList = [testNewOrderData2];

    await expect(async () => {
      await repository.putOrders(applicationContext, ordersList);
    }).rejects.toThrow(`Failed to authenticate to Azure`);
  });

  test('should not put an empty order array', async () => {
    const ordersList: Order[] = [];

    // TODO: We need a better way to spy deeper into the orders cosmos DB humble object.
    const databaseSpy = jest.spyOn(FakeOrdersCosmosClientHumble.prototype, 'database');

    await repository.putOrders(applicationContext, ordersList);
    expect(databaseSpy).not.toHaveBeenCalled();
  });

  test('should put an order array', async () => {
    const positiveTestNewOrderData1: Order = {
      ...testNewOrderData,
      caseId: '999-00-99999',
    };
    delete positiveTestNewOrderData1.id;
    const positiveTestNewOrderData2: Order = {
      ...testNewOrderData,
      caseId: '888-00-99999',
    };
    delete positiveTestNewOrderData2.id;
    const ordersList = [positiveTestNewOrderData1, positiveTestNewOrderData2];

    // TODO: We need a better way to spy deeper into the orders cosmos DB humble object.
    const databaseSpy = jest.spyOn(FakeOrdersCosmosClientHumble.prototype, 'database');

    await repository.putOrders(applicationContext, ordersList);
    expect(databaseSpy).toHaveBeenCalledTimes(ordersList.length);
  });
});
