import { beforeAll, beforeEach, describe, test, expect, vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import MigrateLegacyOrderShapeUseCase from './migrate-legacy-order-shape';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import MockData from '@common/cams/test-utilities/mock-data';
import { ConsolidationOrder, TransferOrder } from '@common/cams/orders';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';

type LegacyConsolidationOrder = ConsolidationOrder & { _id: string; orderType?: string };
type LegacyTransferOrder = TransferOrder & { _id: string; orderType?: string };
type LegacyVerification = TrusteeMatchVerification & { _id: string; orderType?: string };

function makeLegacyConsolidationOrder(
  override: Partial<ConsolidationOrder> = {},
): LegacyConsolidationOrder {
  const order = MockData.getConsolidationOrder({ override });
  const { taskType: _taskType, taskDate: _taskDate, ...legacyShape } = order;
  return {
    ...legacyShape,
    orderType: 'consolidation',
    _id: order.consolidationId,
  } as LegacyConsolidationOrder;
}

function makeLegacyTransferOrder(override: Partial<TransferOrder> = {}): LegacyTransferOrder {
  const order = MockData.getTransferOrder({ override });
  const { taskType: _taskType, taskDate: _taskDate, ...legacyShape } = order;
  return {
    ...legacyShape,
    orderType: 'transfer',
    _id: order.id,
  } as LegacyTransferOrder;
}

function makeLegacyVerification(
  override: Partial<TrusteeMatchVerification> = {},
): LegacyVerification {
  const verification: TrusteeMatchVerification = {
    id: 'verification-1',
    documentType: 'TRUSTEE_MATCH_VERIFICATION',
    caseId: 'case-001',
    courtId: '081',
    dxtrTrustee: { fullName: 'John Doe' },
    matchCandidates: [],
    taskType: 'trustee-match',
    status: 'pending',
    createdOn: '2025-03-01T00:00:00.000Z',
    updatedOn: '2025-03-01T00:00:00.000Z',
    updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
    ...override,
  };
  const { taskType: _taskType, taskDate: _taskDate, ...legacyShape } = verification;
  return {
    ...legacyShape,
    orderType: 'trustee-match',
    _id: verification.id,
  } as LegacyVerification;
}

describe('MigrateLegacyOrderShapeUseCase', () => {
  let context: ApplicationContext;

  beforeAll(async () => {
    context = await createMockApplicationContext();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPageNeedingMigration', () => {
    test('should return a page of consolidation orders with legacy shape', async () => {
      const order = makeLegacyConsolidationOrder({ orderDate: '2025-02-10T00:00:00.000Z' });

      vi.spyOn(MockMongoRepository.prototype, 'findOrdersWithLegacyShape').mockResolvedValue([
        order,
      ]);

      const result = await MigrateLegacyOrderShapeUseCase.getPageNeedingMigration(
        context,
        'consolidation',
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
      const order1 = makeLegacyTransferOrder();
      const order2 = makeLegacyTransferOrder();

      vi.spyOn(MockMongoRepository.prototype, 'findOrdersWithLegacyShape').mockResolvedValue([
        order1,
        order2,
      ]);

      const result = await MigrateLegacyOrderShapeUseCase.getPageNeedingMigration(
        context,
        'transfer',
        null,
        1,
      );

      expect(result.data?.orders.length).toBe(1);
      expect(result.data?.hasMore).toBe(true);
      expect(result.data?.lastId).toBe(order1._id);
    });

    test('should return empty page when no orders found', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findOrdersWithLegacyShape').mockResolvedValue([]);

      const result = await MigrateLegacyOrderShapeUseCase.getPageNeedingMigration(
        context,
        'consolidation',
        'some-cursor',
        100,
      );

      expect(result.error).toBeUndefined();
      expect(result.data?.orders.length).toBe(0);
      expect(result.data?.hasMore).toBe(false);
      expect(result.data?.lastId).toBeNull();
    });

    test('should return error when repo call fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findOrdersWithLegacyShape').mockRejectedValue(
        new Error('Database error'),
      );

      const result = await MigrateLegacyOrderShapeUseCase.getPageNeedingMigration(
        context,
        'consolidation',
        null,
        100,
      );

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('migrateOrders', () => {
    test('should rename orderType to taskType and set taskDate from orderDate atomically', async () => {
      const order = makeLegacyConsolidationOrder({ orderDate: '2025-02-10T00:00:00.000Z' });
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateManyByQuery')
        .mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

      const result = await MigrateLegacyOrderShapeUseCase.migrateOrders(context, 'consolidation', [
        order,
      ]);

      expect(result.error).toBeUndefined();
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].success).toBe(true);
      expect(updateSpy).toHaveBeenCalledTimes(1);
      const [, update] = updateSpy.mock.calls[0];
      expect(update).toEqual({
        $rename: { orderType: 'taskType' },
        $set: { taskDate: '2025-02-10T00:00:00.000Z' },
      });
    });

    test('should skip and fail when orderDate is missing', async () => {
      const order = makeLegacyTransferOrder();
      delete (order as Partial<TransferOrder>).orderDate;
      const updateSpy = vi.spyOn(MockMongoRepository.prototype, 'updateManyByQuery');

      const result = await MigrateLegacyOrderShapeUseCase.migrateOrders(context, 'transfer', [
        order,
      ]);

      expect(result.error).toBeUndefined();
      expect(result.data?.[0].success).toBe(false);
      expect(updateSpy).not.toHaveBeenCalled();
    });

    test('should record failure when update throws, and continue processing', async () => {
      const order1 = makeLegacyConsolidationOrder({ orderDate: '2025-02-10T00:00:00.000Z' });
      const order2 = makeLegacyConsolidationOrder({ orderDate: '2025-02-15T00:00:00.000Z' });

      vi.spyOn(MockMongoRepository.prototype, 'updateManyByQuery')
        .mockRejectedValueOnce(new Error('write failed'))
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      const result = await MigrateLegacyOrderShapeUseCase.migrateOrders(context, 'consolidation', [
        order1,
        order2,
      ]);

      expect(result.data?.length).toBe(2);
      expect(result.data?.[0].success).toBe(false);
      expect(result.data?.[0].error).toContain('write failed');
      expect(result.data?.[1].success).toBe(true);
    });

    test('should compute taskDate from createdOn for trustee-match verifications (no orderDate)', async () => {
      const verification = makeLegacyVerification({ createdOn: '2025-03-05T00:00:00.000Z' });
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateManyByQuery')
        .mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

      const result = await MigrateLegacyOrderShapeUseCase.migrateOrders(context, 'trustee-match', [
        verification,
      ]);

      expect(result.data?.[0].success).toBe(true);
      const [, update] = updateSpy.mock.calls[0];
      expect(update).toEqual({
        $rename: { orderType: 'taskType' },
        $set: { taskDate: '2025-03-05T00:00:00.000Z' },
      });
    });

    test('should fall back to updatedOn when createdOn is absent for trustee-match verifications', async () => {
      const verification = makeLegacyVerification({
        createdOn: undefined,
        updatedOn: '2025-03-10T00:00:00.000Z',
      });
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateManyByQuery')
        .mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

      const result = await MigrateLegacyOrderShapeUseCase.migrateOrders(context, 'trustee-match', [
        verification,
      ]);

      expect(result.data?.[0].success).toBe(true);
      const [, update] = updateSpy.mock.calls[0];
      expect(update).toEqual({
        $rename: { orderType: 'taskType' },
        $set: { taskDate: '2025-03-10T00:00:00.000Z' },
      });
    });
  });

  describe('processMigrationPage', () => {
    test('should return ok with successCount and nextCursor when more pages remain', async () => {
      const order1 = makeLegacyConsolidationOrder({ orderDate: '2025-02-10T00:00:00.000Z' });
      const order2 = makeLegacyConsolidationOrder({ orderDate: '2025-02-15T00:00:00.000Z' });

      vi.spyOn(MockMongoRepository.prototype, 'findOrdersWithLegacyShape').mockResolvedValue([
        order1,
        order2,
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'updateManyByQuery').mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1,
      });

      const result = await MigrateLegacyOrderShapeUseCase.processMigrationPage(
        context,
        'consolidation',
        null,
        1,
      );

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.successCount).toBe(1);
      expect(result.nextCursor).not.toBeNull();
    });

    test('should return ok with failedResults when individual updates fail', async () => {
      const order1 = makeLegacyTransferOrder({ orderDate: '2025-02-10T00:00:00.000Z' });
      const order2 = makeLegacyTransferOrder({ orderDate: '2025-02-15T00:00:00.000Z' });

      vi.spyOn(MockMongoRepository.prototype, 'findOrdersWithLegacyShape').mockResolvedValue([
        order1,
        order2,
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'updateManyByQuery')
        .mockRejectedValueOnce(new Error('write failed'))
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

      const result = await MigrateLegacyOrderShapeUseCase.processMigrationPage(
        context,
        'transfer',
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

    test('should return empty when no orders need migration', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findOrdersWithLegacyShape').mockResolvedValue([]);

      const result = await MigrateLegacyOrderShapeUseCase.processMigrationPage(
        context,
        'consolidation',
        null,
        100,
      );

      expect(result.status).toBe('empty');
    });

    test('should return error when getPageNeedingMigration fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findOrdersWithLegacyShape').mockRejectedValue(
        new Error('DB error'),
      );

      const result = await MigrateLegacyOrderShapeUseCase.processMigrationPage(
        context,
        'consolidation',
        null,
        100,
      );

      expect(result.status).toBe('error');
    });
  });

  describe('countLegacyOrders', () => {
    test.each([['transfer' as const], ['consolidation' as const], ['trustee-match' as const]])(
      'should return the legacy-shape count for %s',
      async (kind) => {
        vi.spyOn(MockMongoRepository.prototype, 'countOrdersWithLegacyShape').mockResolvedValue(7);

        const result = await MigrateLegacyOrderShapeUseCase.countLegacyOrders(context, kind);

        expect(result).toBe(7);
      },
    );
  });
});
