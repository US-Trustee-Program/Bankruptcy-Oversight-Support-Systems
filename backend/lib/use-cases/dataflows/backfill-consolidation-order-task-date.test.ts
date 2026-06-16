import { beforeAll, beforeEach, describe, test, expect, vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import BackfillConsolidationOrderTaskDateUseCase from './backfill-consolidation-order-task-date';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import MockData from '@common/cams/test-utilities/mock-data';
import { ConsolidationOrder } from '@common/cams/orders';

type BackfillConsolidationOrder = ConsolidationOrder & { _id: string };

function makeOrder(override: Partial<ConsolidationOrder> = {}): BackfillConsolidationOrder {
  const order = MockData.getConsolidationOrder({ override });
  return { ...order, _id: order.consolidationId };
}

describe('BackfillConsolidationOrderTaskDateUseCase', () => {
  let context: ApplicationContext;

  beforeAll(async () => {
    context = await createMockApplicationContext();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPageNeedingBackfill', () => {
    test('should return a page of consolidation orders missing taskDate', async () => {
      const order = makeOrder({ orderDate: '2025-02-10T00:00:00.000Z' });

      vi.spyOn(
        MockMongoRepository.prototype,
        'findConsolidationOrdersMissingTaskDate',
      ).mockResolvedValue([order]);

      const result = await BackfillConsolidationOrderTaskDateUseCase.getPageNeedingBackfill(
        context,
        null,
        100,
      );

      expect(result.error).toBeUndefined();
      expect(result.data?.orders.length).toBe(1);
      expect(result.data?.orders[0]._id).toBe(order._id);
      expect(result.data?.hasMore).toBe(false);
      expect(result.data?.lastId).toBe(order._id);
    });

    test('should detect hasMore when results exceed limit', async () => {
      const order1 = makeOrder();
      const order2 = makeOrder();

      vi.spyOn(
        MockMongoRepository.prototype,
        'findConsolidationOrdersMissingTaskDate',
      ).mockResolvedValue([order1, order2]);

      const result = await BackfillConsolidationOrderTaskDateUseCase.getPageNeedingBackfill(
        context,
        null,
        1,
      );

      expect(result.data?.orders.length).toBe(1);
      expect(result.data?.hasMore).toBe(true);
      expect(result.data?.lastId).toBe(order1._id);
    });

    test('should return empty page when no orders found', async () => {
      vi.spyOn(
        MockMongoRepository.prototype,
        'findConsolidationOrdersMissingTaskDate',
      ).mockResolvedValue([]);

      const result = await BackfillConsolidationOrderTaskDateUseCase.getPageNeedingBackfill(
        context,
        'some-cursor',
        100,
      );

      expect(result.error).toBeUndefined();
      expect(result.data?.orders.length).toBe(0);
      expect(result.data?.hasMore).toBe(false);
      expect(result.data?.lastId).toBeNull();
    });

    test('should return error when repo call fails', async () => {
      vi.spyOn(
        MockMongoRepository.prototype,
        'findConsolidationOrdersMissingTaskDate',
      ).mockRejectedValue(new Error('Database error'));

      const result = await BackfillConsolidationOrderTaskDateUseCase.getPageNeedingBackfill(
        context,
        null,
        100,
      );

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('backfillTaskDates', () => {
    test('should set taskDate from orderDate for each order', async () => {
      const order = makeOrder({ orderDate: '2025-02-10T00:00:00.000Z' });
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateConsolidationOrderTaskDate')
        .mockResolvedValue();

      const result = await BackfillConsolidationOrderTaskDateUseCase.backfillTaskDates(context, [
        order,
      ]);

      expect(result.error).toBeUndefined();
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(order._id, '2025-02-10T00:00:00.000Z');
    });

    test('should skip and fail when orderDate is missing', async () => {
      const order = makeOrder();
      delete (order as Partial<ConsolidationOrder>).orderDate;
      const updateSpy = vi.spyOn(MockMongoRepository.prototype, 'updateConsolidationOrderTaskDate');

      const result = await BackfillConsolidationOrderTaskDateUseCase.backfillTaskDates(context, [
        order,
      ]);

      expect(result.error).toBeUndefined();
      expect(result.data?.[0].success).toBe(false);
      expect(updateSpy).not.toHaveBeenCalled();
    });

    test('should record failure when update throws, and continue processing', async () => {
      const order1 = makeOrder({ orderDate: '2025-02-10T00:00:00.000Z' });
      const order2 = makeOrder({ orderDate: '2025-02-15T00:00:00.000Z' });

      vi.spyOn(MockMongoRepository.prototype, 'updateConsolidationOrderTaskDate')
        .mockRejectedValueOnce(new Error('write failed'))
        .mockResolvedValueOnce(undefined);

      const result = await BackfillConsolidationOrderTaskDateUseCase.backfillTaskDates(context, [
        order1,
        order2,
      ]);

      expect(result.data?.length).toBe(2);
      expect(result.data?.[0].success).toBe(false);
      expect(result.data?.[0].error).toContain('write failed');
      expect(result.data?.[1].success).toBe(true);
    });
  });

  describe('processBackfillPage', () => {
    test('should return ok with successCount and nextCursor when more pages remain', async () => {
      const order1 = makeOrder({ orderDate: '2025-02-10T00:00:00.000Z' });
      const order2 = makeOrder({ orderDate: '2025-02-15T00:00:00.000Z' });

      vi.spyOn(
        MockMongoRepository.prototype,
        'findConsolidationOrdersMissingTaskDate',
      ).mockResolvedValue([order1, order2]);
      vi.spyOn(
        MockMongoRepository.prototype,
        'updateConsolidationOrderTaskDate',
      ).mockResolvedValue();

      const result = await BackfillConsolidationOrderTaskDateUseCase.processBackfillPage(
        context,
        null,
        1,
      );

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.successCount).toBe(1);
      expect(result.nextCursor).not.toBeNull();
    });

    test('should return ok with failedResults when individual updates fail', async () => {
      const order1 = makeOrder({ orderDate: '2025-02-10T00:00:00.000Z' });
      const order2 = makeOrder({ orderDate: '2025-02-15T00:00:00.000Z' });

      vi.spyOn(
        MockMongoRepository.prototype,
        'findConsolidationOrdersMissingTaskDate',
      ).mockResolvedValue([order1, order2]);
      vi.spyOn(MockMongoRepository.prototype, 'updateConsolidationOrderTaskDate')
        .mockRejectedValueOnce(new Error('write failed'))
        .mockResolvedValueOnce(undefined);

      const result = await BackfillConsolidationOrderTaskDateUseCase.processBackfillPage(
        context,
        null,
        10,
      );

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.successCount).toBe(1);
      expect(result.processedCount).toBe(2);
      expect(result.failedResults).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });

    test('should return empty when no orders need backfill', async () => {
      vi.spyOn(
        MockMongoRepository.prototype,
        'findConsolidationOrdersMissingTaskDate',
      ).mockResolvedValue([]);

      const result = await BackfillConsolidationOrderTaskDateUseCase.processBackfillPage(
        context,
        null,
        100,
      );

      expect(result.status).toBe('empty');
    });

    test('should return error when getPageNeedingBackfill fails', async () => {
      vi.spyOn(
        MockMongoRepository.prototype,
        'findConsolidationOrdersMissingTaskDate',
      ).mockRejectedValue(new Error('DB error'));

      const result = await BackfillConsolidationOrderTaskDateUseCase.processBackfillPage(
        context,
        null,
        100,
      );

      expect(result.status).toBe('error');
    });
  });
});
