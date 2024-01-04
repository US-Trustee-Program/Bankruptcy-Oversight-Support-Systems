import { OrdersCosmosDbRepository } from './orders.cosmosdb.repository';
import { ORDERS } from '../../testing/mock-data/orders.mock';
import { Order, OrderTransfer } from '../../use-cases/orders/orders.model';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../types/basic';
import { THROW_PERMISSIONS_ERROR_CASE_ID } from '../../testing/testing-constants';
import { HumbleItem, HumbleItems, HumbleQuery } from '../../testing/mock.cosmos-client-humble';
import { UnknownError } from '../../common-errors/unknown-error';
import { AggregateAuthenticationError } from '@azure/identity';
import { ForbiddenError } from '../../common-errors/forbidden-error';

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
    jest.clearAllMocks();
  });

  test('should get a list of orders', async () => {
    const mockRead = jest.spyOn(HumbleQuery.prototype, 'fetchAll').mockReturnValue({
      resources: ORDERS,
    });

    const testResult = await repository.getOrders(applicationContext);

    expect(testResult).toEqual(ORDERS);
    expect(mockRead).toHaveBeenCalled();
  });

  test('When updating an order, Should throw Unknown Error if an unknown error occurs', async () => {
    const mockRead = jest.spyOn(HumbleItem.prototype, 'read').mockImplementation(() => {
      throw new Error('Replace error');
    });

    await expect(
      repository.updateOrder(applicationContext, testNewOrderData.id, testNewOrderTransferData),
    ).rejects.toThrow(`Replace error`);
    expect(mockRead).toHaveBeenCalled();
  });

  test('Should update order and return a cosmos order id', async () => {
    const mockRead = jest.spyOn(HumbleItem.prototype, 'read').mockImplementation(() => ({
      resource: testNewOrderData,
    }));
    const mockReplace = jest.spyOn(HumbleItem.prototype, 'replace').mockImplementation(() => {
      return {
        id: testNewOrderData.id,
      };
    });
    const testResult = await repository.updateOrder(
      applicationContext,
      testNewOrderData.id,
      testNewOrderTransferData,
    );
    expect(testResult).toEqual({ id: testNewOrderData.id });
    expect(mockRead).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalled();
  });

  test('Should throw a NotFoundError if attempting to update a document that does not exist.', async () => {
    const mockRead = jest.spyOn(HumbleItem.prototype, 'read').mockImplementation(() => ({
      resource: undefined,
    }));
    await expect(
      repository.updateOrder(applicationContext, testNewOrderData.id, testNewOrderTransferData),
    ).rejects.toThrow(`Order not found with id ${testNewOrderTransferData.id}`);
    expect(mockRead).toHaveBeenCalled();
  });

  test('When putting an order, Should throw Unknown Error if an unknown error occurs', async () => {
    const errorTestNewOrderData: Order = {
      ...testNewOrderData,
    };
    delete errorTestNewOrderData.id;

    const mockRead = jest.spyOn(HumbleItems.prototype, 'create').mockImplementation(() => {
      throw new UnknownError('TEST_MODULE', { message: 'unknown error' });
    });

    await expect(repository.putOrders(applicationContext, [errorTestNewOrderData])).rejects.toThrow(
      `unknown error`,
    );
    expect(mockRead).toHaveBeenCalled();
  });

  test('When putting an order, Should throw ServerConfigError if an AggregateAuthenticationError error occurs', async () => {
    const testNewOrderData2: Order = {
      ...testNewOrderData,
      caseId: THROW_PERMISSIONS_ERROR_CASE_ID,
    };
    delete testNewOrderData2.id;
    const ordersList = [testNewOrderData2];

    const mockCreate = jest.spyOn(HumbleItems.prototype, 'create').mockImplementation(() => {
      throw new AggregateAuthenticationError([
        new ForbiddenError('TEST_MODULE', { message: 'forbidden' }),
      ]);
    });

    await expect(async () => {
      await repository.putOrders(applicationContext, ordersList);
    }).rejects.toThrow(`Failed to authenticate to Azure`);
    expect(mockCreate).toHaveBeenCalled();
  });

  test('should not put an empty order array', async () => {
    const ordersList: Order[] = [];

    const create = jest.spyOn(HumbleItems.prototype, 'create');

    await repository.putOrders(applicationContext, ordersList);
    expect(create).not.toHaveBeenCalled();
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

    const mockCreate = jest.spyOn(HumbleItems.prototype, 'create').mockImplementation(() => {
      return;
    });

    await repository.putOrders(applicationContext, ordersList);
    expect(mockCreate).toHaveBeenCalledTimes(ordersList.length);
  });

  test('should throw ServerConfigError if an AggregateAuthenticationError error is encountered', async () => {
    const fetchAll = jest.spyOn(HumbleQuery.prototype, 'fetchAll').mockImplementationOnce(() => {
      throw new AggregateAuthenticationError([], 'Mock AggregateAuthenticationError');
    });
    await expect(repository.getOrders(applicationContext)).rejects.toThrow(
      `Failed to authenticate to Azure`,
    );
    expect(fetchAll).toHaveBeenCalled();

    const create = jest.spyOn(HumbleItems.prototype, 'create').mockImplementationOnce(() => {
      throw new AggregateAuthenticationError([], 'Mock AggregateAuthenticationError');
    });
    await expect(repository.putOrders(applicationContext, [testNewOrderData])).rejects.toThrow(
      `Failed to authenticate to Azure`,
    );
    expect(create).toHaveBeenCalled();

    const read = jest.spyOn(HumbleItem.prototype, 'read').mockImplementationOnce(() => {
      throw new AggregateAuthenticationError([], 'Mock AggregateAuthenticationError');
    });
    await expect(
      repository.updateOrder(applicationContext, testNewOrderData.id, testNewOrderTransferData),
    ).rejects.toThrow(`Failed to authenticate to Azure`);
    expect(read).toHaveBeenCalled();
  });

  test('should throw all other encountered errors', async () => {
    const mockRead = jest.spyOn(HumbleQuery.prototype, 'fetchAll').mockImplementationOnce(() => {
      throw new UnknownError('TEST_MODULE', { message: 'test error' });
    });
    await expect(repository.getOrders(applicationContext)).rejects.toThrow(`test error`);
    expect(mockRead).toHaveBeenCalled();
  });
});
