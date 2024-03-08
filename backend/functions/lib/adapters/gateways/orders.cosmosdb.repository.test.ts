import { OrdersCosmosDbRepository } from './orders.cosmosdb.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../types/basic';
import { THROW_PERMISSIONS_ERROR_CASE_ID } from '../../testing/testing-constants';
import {
  MockHumbleItem,
  MockHumbleItems,
  MockHumbleQuery,
} from '../../testing/mock.cosmos-client-humble';
import { UnknownError } from '../../common-errors/unknown-error';
import { AggregateAuthenticationError } from '@azure/identity';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { createPreExistingDocumentError } from '../../testing/cosmos-errors';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { TransferOrder, TransferOrderAction } from '../../../../../common/src/cams/orders';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';

const testNewOrderTransferData: TransferOrderAction = {
  id: 'test-id-0',
  caseId: '111-11-11111',
  newCase: {
    caseId: '000-01-12345',
    courtName: 'New Court Name',
    courtDivisionName: 'New Division',
    courtDivision: '081',
    regionId: '02',
    regionName: 'NEW YORK',
  },
  status: 'approved',
};

const testNewOrderData = MockData.getTransferOrder({ override: { id: 'test-id-0' } });

describe('Test case assignment cosmosdb repository tests', () => {
  let repository: OrdersCosmosDbRepository;
  let applicationContext: ApplicationContext;

  beforeEach(async () => {
    jest.clearAllMocks();
    applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    repository = new OrdersCosmosDbRepository(applicationContext);
  });

  test('should get a list of orders', async () => {
    const mockOrders = [MockData.getTransferOrder(), MockData.getConsolidationOrder()];
    const mockFetchAll = jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: mockOrders,
    });

    const testResult = await repository.getOrders(applicationContext);

    expect(testResult).toEqual(mockOrders);
    expect(mockFetchAll).toHaveBeenCalled();
  });

  test('should get a transfer order', async () => {
    const mockOrders = [MockData.getTransferOrder()];
    const order = { ...mockOrders[0] };
    const mockRead = jest.spyOn(MockHumbleItem.prototype, 'read').mockResolvedValue({
      resource: order,
    });

    const testResult = await repository.getOrder(applicationContext, order.id, order.caseId);

    expect(testResult).toEqual(order);
    expect(mockRead).toHaveBeenCalled();
  });

  test('should get a consolidation order', async () => {
    const mockOrders = [MockData.getConsolidationOrder()];
    const order = { ...mockOrders[0] };
    const mockRead = jest.spyOn(MockHumbleItem.prototype, 'read').mockResolvedValue({
      resource: order,
    });

    const testResult = await repository.getOrder(
      applicationContext,
      order.id,
      order.consolidationId,
    );

    expect(testResult).toEqual(order);
    expect(mockRead).toHaveBeenCalled();
  });

  test('When updating an order, Should throw Unknown Error if an unknown error occurs', async () => {
    const mockRead = jest.spyOn(MockHumbleItem.prototype, 'read').mockImplementation(() => {
      throw new Error('Replace error');
    });

    await expect(
      repository.updateOrder(applicationContext, testNewOrderData.id, testNewOrderTransferData),
    ).rejects.toThrow(`Replace error`);
    expect(mockRead).toHaveBeenCalled();
  });

  test('Should update order and return a cosmos order id', async () => {
    const mockRead = jest.spyOn(MockHumbleItem.prototype, 'read').mockResolvedValue({
      resource: testNewOrderData,
    });
    const mockReplace = jest.spyOn(MockHumbleItem.prototype, 'replace').mockResolvedValue({
      resource: testNewOrderData,
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
    const mockRead = jest.spyOn(MockHumbleItem.prototype, 'read').mockResolvedValue({
      resource: undefined,
    });
    await expect(
      repository.updateOrder(applicationContext, testNewOrderData.id, testNewOrderTransferData),
    ).rejects.toThrow(`Order not found with id ${testNewOrderTransferData.id}`);
    expect(mockRead).toHaveBeenCalled();
  });

  test('When putting an order, Should throw Unknown Error if an unknown error occurs', async () => {
    const errorTestNewOrderData: TransferOrder = {
      ...testNewOrderData,
    };
    delete errorTestNewOrderData.id;

    const mockCreate = jest.spyOn(MockHumbleItems.prototype, 'create').mockImplementation(() => {
      throw new UnknownError('TEST_MODULE', { message: 'unknown error' });
    });

    await expect(repository.putOrders(applicationContext, [errorTestNewOrderData])).rejects.toThrow(
      `unknown error`,
    );
    expect(mockCreate).toHaveBeenCalled();
  });

  test('should ignore an existing document error when putting an order', async () => {
    const errorTestNewOrderData: TransferOrder = {
      ...testNewOrderData,
    };
    delete errorTestNewOrderData.id;

    const mockCreate = jest
      .spyOn(MockHumbleItems.prototype, 'create')
      .mockRejectedValue(createPreExistingDocumentError());

    await expect(
      repository.putOrders(applicationContext, [errorTestNewOrderData]),
    ).resolves.toHaveLength(0);
    expect(mockCreate).toHaveBeenCalled();
  });

  test('When putting an order, Should throw ServerConfigError if an AggregateAuthenticationError error occurs', async () => {
    const testNewOrderData2: TransferOrder = {
      ...testNewOrderData,
      caseId: THROW_PERMISSIONS_ERROR_CASE_ID,
    };
    delete testNewOrderData2.id;
    const ordersList = [testNewOrderData2];

    const mockCreate = jest.spyOn(MockHumbleItems.prototype, 'create').mockImplementation(() => {
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
    const ordersList: TransferOrder[] = [];

    const create = jest.spyOn(MockHumbleItems.prototype, 'create');

    await repository.putOrders(applicationContext, ordersList);
    expect(create).not.toHaveBeenCalled();
  });

  test('should put an order array', async () => {
    const positiveTestNewOrderData1: TransferOrder = {
      ...testNewOrderData,
      caseId: '999-00-99999',
      id: undefined,
    };
    const positiveTestNewOrderData2: TransferOrder = {
      ...testNewOrderData,
      caseId: '888-00-99999',
      id: undefined,
    };
    const ordersList = [positiveTestNewOrderData1, positiveTestNewOrderData2];

    const mockCreate = jest
      .spyOn(MockHumbleItems.prototype, 'create')
      .mockImplementation(jest.fn());

    await repository.putOrders(applicationContext, ordersList);
    expect(mockCreate).toHaveBeenCalledTimes(ordersList.length);
  });

  test('should throw ServerConfigError if an AggregateAuthenticationError error is encountered', async () => {
    const aggregateError = new AggregateAuthenticationError(
      [],
      'Mock AggregateAuthenticationError',
    );
    const serverConfigError = new ServerConfigError('', {
      message: 'Failed to authenticate to Azure',
    });
    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockRejectedValue(aggregateError);
    jest.spyOn(MockHumbleItems.prototype, 'create').mockRejectedValue(aggregateError);
    jest.spyOn(MockHumbleItem.prototype, 'read').mockRejectedValue(aggregateError);

    await expect(repository.getOrders(applicationContext)).rejects.toThrow(serverConfigError);
    await expect(
      repository.getOrder(applicationContext, testNewOrderData.id, testNewOrderData.caseId),
    ).rejects.toThrow(serverConfigError);
    await expect(repository.putOrders(applicationContext, [testNewOrderData])).rejects.toThrow(
      serverConfigError,
    );
    await expect(
      repository.updateOrder(applicationContext, testNewOrderData.id, testNewOrderTransferData),
    ).rejects.toThrow(serverConfigError);
  });

  test('should throw all other encountered errors', async () => {
    const error = new UnknownError('TEST_MODULE', { message: 'test error' });
    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockRejectedValue(error);
    jest.spyOn(MockHumbleItem.prototype, 'read').mockRejectedValue(error);
    jest.spyOn(MockHumbleItems.prototype, 'create').mockRejectedValue(error);

    await expect(repository.getOrders(applicationContext)).rejects.toThrow(error);
    await expect(
      repository.getOrder(applicationContext, testNewOrderData.id, testNewOrderData.caseId),
    ).rejects.toThrow(error);
    await expect(repository.putOrders(applicationContext, [testNewOrderData])).rejects.toThrow(
      error,
    );
    await expect(
      repository.updateOrder(applicationContext, testNewOrderData.id, testNewOrderTransferData),
    ).rejects.toThrow(error);
  });
});
