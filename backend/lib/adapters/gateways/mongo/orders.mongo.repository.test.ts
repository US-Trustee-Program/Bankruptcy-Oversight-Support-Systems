import { vi } from 'vitest';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { OrdersMongoRepository } from './orders.mongo.repository';
import { ApplicationContext } from '../../types/basic';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { TransferOrder, TransferOrderAction } from '../../../../../common/src/cams/orders';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import QueryBuilder from '../../../query/query-builder';
import { closeDeferred } from '../../../deferrable/defer-close';
import { UnknownError } from '../../../common-errors/unknown-error';
import { NotFoundError } from '../../../common-errors/not-found-error';

describe('orders repo', () => {
  let context: ApplicationContext;
  let repo: OrdersMongoRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = OrdersMongoRepository.getInstance(context);
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await closeDeferred(context);
    repo.release();
  });

  test('search function happy path should return orders when a predicate is supplied', async () => {
    const expectedOrders = [
      MockData.getTransferOrder({ override: { courtDivisionCode: '081' } }),
      MockData.getTransferOrder({ override: { courtDivisionCode: '081' } }),
      MockData.getTransferOrder({ override: { courtDivisionCode: '081' } }),
    ];
    vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(expectedOrders);

    const predicate = {
      divisionCodes: ['081'],
    };
    const actualOrders = await repo.search(predicate);

    expect(actualOrders).toEqual(expectedOrders);
    expect(actualOrders.length).toEqual(3);
  });

  test('search function should return orders when no predicate is supplied', async () => {
    const expectedOrders = [
      MockData.getTransferOrder({ override: { courtDivisionCode: '081' } }),
      MockData.getTransferOrder({ override: { courtDivisionCode: '081' } }),
    ];
    vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(expectedOrders);
    const predicate = undefined;
    const actualOrders = await repo.search(predicate);

    expect(actualOrders).toEqual(expectedOrders);
    expect(actualOrders.length).toEqual(2);
  });

  test('search function should throw error when dbAdapter throws an error', async () => {
    vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(new Error('some error'));
    const predicate = {
      divisionCodes: ['081'],
    };
    await expect(async () => await repo.search(predicate)).rejects.toThrow(UnknownError);
  });

  test('should insert an array of transfer orders', async () => {
    const commonTestId = 'testId';
    const transfers = MockData.buildArray(MockData.getTransferOrder, 4);
    const expectedOrders = [...transfers].map((order) => {
      return { ...order, id: commonTestId };
    });
    vi.spyOn(MongoCollectionAdapter.prototype, 'insertMany').mockResolvedValue(
      expectedOrders.map((order) => order.id),
    );
    const actualOrders = await repo.createMany(expectedOrders);
    expect(actualOrders).toEqual(expectedOrders);
  });

  test('should get one order', async () => {
    const expected = MockData.getTransferOrder();
    vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(expected);
    const actual = await repo.read(expected.id);
    expect(actual).toEqual(expected);
  });

  test('should throw error on read when dbAdapter throws error on findOne', async () => {
    vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(
      new Error('some error'),
    );
    await expect(async () => await repo.read('123')).rejects.toThrow(UnknownError);
  });

  test('should throw NotFound error during update when dbAdapter findOne returns no results', async () => {
    const existing = MockData.getTransferOrder({
      override: { docketSuggestedCaseNumber: undefined },
    });
    const transferOrder: TransferOrderAction = {
      id: existing.id,
      caseId: existing.caseId,
      orderType: 'transfer',
      status: 'rejected', // not approved, and valid
    };
    vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(
      new NotFoundError('test-module'),
    );
    await expect(async () => await repo.update(transferOrder)).rejects.toThrow(NotFoundError);
  });

  test('should throw CamsError error during update when dbAdapter throws error on replaceOne', async () => {
    const existing = MockData.getTransferOrder({
      override: { docketSuggestedCaseNumber: undefined },
    });
    const transferOrder: TransferOrderAction = {
      ...existing,
      newCase: MockData.getCaseSummary(),
      orderType: 'transfer',
      status: 'approved',
    };
    vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(existing);
    vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockRejectedValue(
      new Error('some error'),
    );
    await expect(async () => await repo.update(transferOrder)).rejects.toThrow(UnknownError);
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
    vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(existing);
    const replaceOne = vi
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockResolvedValue(undefined);
    await repo.update(expected);

    const doc = QueryBuilder.using<TransferOrder>();
    const query = doc('id').equals(existing.id);

    expect(replaceOne).toHaveBeenCalledWith(query, expected);
  });

  test('should throw CamsError error during createMany when dbAdapter throws error on insertMany', async () => {
    const newOrders = MockData.buildArray(MockData.getTransferOrder, 3);
    vi.spyOn(MongoCollectionAdapter.prototype, 'insertMany').mockRejectedValue(
      new Error('some value'),
    );
    await expect(async () => await repo.createMany(newOrders)).rejects.toThrow(UnknownError);
  });

  test('should return empty array when createMany is supplied with an empty array', async () => {
    const actualArray = await repo.createMany([]);
    expect(actualArray).toEqual([]);
  });

  // --- Additional tests for full branch coverage ---
  describe('Singleton logic', () => {
    let context: ApplicationContext;
    beforeEach(async () => {
      context = await createMockApplicationContext();
      OrdersMongoRepository['instance'] = null;
      OrdersMongoRepository['referenceCount'] = 0;
    });

    test('getInstance returns the same instance and increments referenceCount', () => {
      const first = OrdersMongoRepository.getInstance(context);
      const second = OrdersMongoRepository.getInstance(context);
      expect(first).toBe(second);
      expect(OrdersMongoRepository['referenceCount']).toBe(2);
    });

    test('dropInstance does not throw if called when referenceCount is 0 and instance is null', () => {
      OrdersMongoRepository['instance'] = null;
      OrdersMongoRepository['referenceCount'] = 0;
      expect(() => OrdersMongoRepository.dropInstance()).not.toThrow();
    });

    test('dropInstance closes client and sets instance to null when referenceCount drops below 1', async () => {
      const mockClose = vi.fn().mockResolvedValue(undefined);
      OrdersMongoRepository['instance'] = {
        client: { close: mockClose },
      } as unknown as OrdersMongoRepository;
      OrdersMongoRepository['referenceCount'] = 1;
      OrdersMongoRepository.dropInstance();
      // Wait for the .then() to resolve
      await Promise.resolve();
      expect(mockClose).toHaveBeenCalled();
      expect(OrdersMongoRepository['instance']).toBeNull();
    });
  });

  test('update does not call replaceOne if status is not approved', async () => {
    const existing = MockData.getTransferOrder({
      override: { docketSuggestedCaseNumber: undefined },
    });
    const transferOrder: TransferOrderAction = {
      ...existing,
      newCase: MockData.getCaseSummary(),
      orderType: 'transfer',
      status: 'rejected', // not approved, and valid
      caseId: existing.caseId,
    };
    vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(existing);
    const replaceOne = vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne');
    await repo.update(transferOrder);
    expect(replaceOne).not.toHaveBeenCalled();
  });
});
