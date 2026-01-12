import { vi } from 'vitest';
import { ApplicationContext } from '../../types/basic';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import MockData from '@common/cams/test-utilities/mock-data';
import ConsolidationOrdersMongoRepository from './consolidations.mongo.repository';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import QueryBuilder from '../../../query/query-builder';
import { closeDeferred } from '../../../deferrable/defer-close';
import { ConsolidationOrder } from '@common/cams/orders';

describe('Consolidations Repository tests', () => {
  let context: ApplicationContext;
  let repo: ConsolidationOrdersMongoRepository;
  const { and, orderBy, using } = QueryBuilder;
  const doc = using<ConsolidationOrder>();

  const consolidationId = '823688b3-9e0f-4a02-a7cb-89380e6ad19e';

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = ConsolidationOrdersMongoRepository.getInstance(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    repo.release();
    vi.restoreAllMocks();
  });

  test('should search on consolidations by court division code or consolidationId', async () => {
    const consolidationOrder = MockData.getConsolidationOrder({
      override: { consolidationId, courtDivisionCode: '081' },
    });
    const findSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue([consolidationOrder]);
    const query = and(
      doc('courtDivisionCode').contains([consolidationOrder.courtDivisionCode]),
      doc('consolidationId').equals(consolidationOrder.consolidationId),
    );
    const results = await repo.search({
      divisionCodes: ['081'],
      consolidationId: consolidationOrder.consolidationId,
    });

    expect(results).toEqual([consolidationOrder]);
    expect(results.length).toEqual(1);
    expect(findSpy).toHaveBeenCalledWith(query, orderBy(['orderDate', 'ASCENDING']));
  });

  test('should search on consolidations with an empty query', async () => {
    const consolidationOrders = MockData.buildArray(MockData.getConsolidationOrder, 5);
    const findSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue(consolidationOrders);
    const results = await repo.search();

    expect(results).toEqual(consolidationOrders);
    expect(findSpy).toHaveBeenCalledWith(null, orderBy(['orderDate', 'ASCENDING']));
  });

  test('should call delete on a consolidation order', async () => {
    const deleteSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockResolvedValue(1);

    await repo.delete(consolidationId);
    expect(deleteSpy).toHaveBeenCalled();
  });

  test('should call read and get consolidation by consolidationId', async () => {
    const consolidationOrder = MockData.getConsolidationOrder({ override: { consolidationId } });
    const findOneSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'findOne')
      .mockResolvedValue(consolidationOrder);
    const results = await repo.read(consolidationId);

    expect(results).toEqual(consolidationOrder);
    expect(findOneSpy).toHaveBeenCalled();
  });

  test('should call insertOne when calling create on the repo', async () => {
    const consolidationOrder = MockData.getConsolidationOrder({ override: { consolidationId } });
    const insertOneSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockResolvedValue(consolidationOrder.id);
    const results = await repo.create(consolidationOrder);

    expect(results).toEqual(consolidationOrder);
    expect(insertOneSpy).toHaveBeenCalledWith(consolidationOrder);
  });

  test('should call insertMany when calling createMany on the repo', async () => {
    const consolidationOrders = MockData.buildArray(MockData.getConsolidationOrder, 3);
    const consolidationIds = [
      consolidationOrders[0].id,
      consolidationOrders[1].id,
      consolidationOrders[2].id,
    ];
    const createManySpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'insertMany')
      .mockResolvedValue(consolidationIds);
    await repo.createMany(consolidationOrders);

    expect(createManySpy).toHaveBeenCalledWith(consolidationOrders);
  });

  const createManyEmptyCases = [
    ['empty', []],
    ['undefined', undefined],
    ['null', null],
  ];
  test.each(createManyEmptyCases)(
    'should not call insertMany with %s list',
    async (_caseName: string, list: []) => {
      const createManySpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'insertMany')
        .mockRejectedValue('This should not throw.');
      await repo.createMany(list);

      expect(createManySpy).not.toHaveBeenCalled();
    },
  );

  test('should update a consolidation order', async () => {
    const consolidationOrder = MockData.getConsolidationOrder({ override: { consolidationId } });
    const updatedConsolidationOrder = {
      ...consolidationOrder,
      orderDate: '2023-01-01',
      orderText: 'Updated order text',
    };

    const findOneSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'findOne')
      .mockResolvedValue(consolidationOrder);

    const replaceOneSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockResolvedValue({ modifiedCount: 1, id: consolidationOrder.id, upsertedCount: 0 });

    const result = await repo.update(updatedConsolidationOrder);

    expect(findOneSpy).toHaveBeenCalledWith(doc('consolidationId').equals(consolidationId));
    expect(replaceOneSpy).toHaveBeenCalledWith(
      doc('consolidationId').equals(consolidationId),
      expect.objectContaining({
        ...consolidationOrder,
        orderDate: '2023-01-01',
        orderText: 'Updated order text',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        ...consolidationOrder,
        orderDate: '2023-01-01',
        orderText: 'Updated order text',
      }),
    );
  });

  test('should count consolidation orders with a specific key root', async () => {
    const keyRoot = 'test-key';
    const countSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'countDocuments')
      .mockResolvedValue(5);

    const result = await repo.count(keyRoot);

    expect(countSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        condition: 'REGEX',
        leftOperand: { name: 'consolidationId' },
      }),
    );
    expect(result).toEqual(5);
  });

  describe('error handling', () => {
    const error = new Error('some error');

    test('should properly handle error when calling search', async () => {
      const consolidationOrder = MockData.getConsolidationOrder({
        override: { consolidationId, courtDivisionCode: '081' },
      });
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(error);
      await expect(() =>
        repo.search({
          divisionCodes: ['081'],
          consolidationId: consolidationOrder.consolidationId,
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          message: 'Unknown Error',
          status: 500,
          module: 'CONSOLIDATIONS-MONGO-REPOSITORY',
          originalError: expect.stringContaining('Error: some error'),
        }),
      );
    });

    test('should properly handle error when calling delete', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockRejectedValue(error);

      await expect(() => repo.delete(consolidationId)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unknown Error',
          status: 500,
          module: 'CONSOLIDATIONS-MONGO-REPOSITORY',
          originalError: expect.stringContaining('Error: some error'),
        }),
      );
    });

    test('should properly handle error when calling read', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(error);
      await expect(() => repo.read(consolidationId)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unknown Error',
          status: 500,
          module: 'CONSOLIDATIONS-MONGO-REPOSITORY',
          originalError: expect.stringContaining('Error: some error'),
        }),
      );
    });

    test('should properly handle error when calling create', async () => {
      const consolidationOrder = MockData.getConsolidationOrder({ override: { consolidationId } });
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(error);
      await expect(() => repo.create(consolidationOrder)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unknown Error',
          status: 500,
          module: 'CONSOLIDATIONS-MONGO-REPOSITORY',
          originalError: expect.stringContaining('Error: some error'),
        }),
      );
    });

    test('should properly handle Error when calling createMany', async () => {
      const consolidationOrders = MockData.buildArray(MockData.getConsolidationOrder, 3);
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertMany').mockRejectedValue(error);
      await expect(() => repo.createMany(consolidationOrders)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unknown Error',
          status: 500,
          module: 'CONSOLIDATIONS-MONGO-REPOSITORY',
          originalError: expect.stringContaining('Error: some error'),
        }),
      );
    });

    test('should properly handle error when calling update', async () => {
      const consolidationOrder = MockData.getConsolidationOrder({ override: { consolidationId } });
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(error);
      await expect(() => repo.update(consolidationOrder)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unknown Error',
          status: 500,
          module: 'CONSOLIDATIONS-MONGO-REPOSITORY',
          originalError: expect.stringContaining('Error: some error'),
        }),
      );
    });

    test('should properly handle error when calling count', async () => {
      const keyRoot = 'test-key';
      vi.spyOn(MongoCollectionAdapter.prototype, 'countDocuments').mockRejectedValue(error);
      await expect(() => repo.count(keyRoot)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unknown Error',
          status: 500,
          module: 'CONSOLIDATIONS-MONGO-REPOSITORY',
          originalError: expect.stringContaining('Error: some error'),
        }),
      );
    });
  });
});
