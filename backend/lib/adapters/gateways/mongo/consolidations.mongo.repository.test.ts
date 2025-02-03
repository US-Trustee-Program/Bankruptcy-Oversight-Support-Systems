import { ApplicationContext } from '../../types/basic';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import ConsolidationOrdersMongoRepository from './consolidations.mongo.repository';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import QueryBuilder from '../../../query/query-builder';
import { closeDeferred } from '../../../deferrable/defer-close';
import { getCamsError } from '../../../common-errors/error-utilities';
import { ConsolidationOrder } from '../../../../../common/src/cams/orders';

describe('Consolidations Repository tests', () => {
  let context: ApplicationContext;
  let repo: ConsolidationOrdersMongoRepository;
  const { and, contains, equals, orderBy } = QueryBuilder;
  const consolidationId = '823688b3-9e0f-4a02-a7cb-89380e6ad19e';

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = ConsolidationOrdersMongoRepository.getInstance(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    repo.release();
    jest.restoreAllMocks();
  });

  test('should search on consolidations by court division code or consolidationId', async () => {
    const consolidationOrder = MockData.getConsolidationOrder({
      override: { consolidationId, courtDivisionCode: '081' },
    });
    const findSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue([consolidationOrder]);
    const query = QueryBuilder.build(
      and(
        contains<ConsolidationOrder['courtDivisionCode']>('courtDivisionCode', [
          consolidationOrder.courtDivisionCode,
        ]),
        equals<ConsolidationOrder['consolidationId']>(
          'consolidationId',
          consolidationOrder.consolidationId,
        ),
      ),
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
    const findSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue(consolidationOrders);
    const results = await repo.search();

    expect(results).toEqual(consolidationOrders);
    expect(findSpy).toHaveBeenCalledWith(null, orderBy(['orderDate', 'ASCENDING']));
  });

  test('should call delete on a consolidation order', async () => {
    const deleteSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'deleteOne')
      .mockResolvedValue(1);

    await repo.delete(consolidationId);
    expect(deleteSpy).toHaveBeenCalled();
  });

  test('should call read and get consolidation by consolidationId', async () => {
    const consolidationOrder = MockData.getConsolidationOrder({ override: { consolidationId } });
    const findOneSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'findOne')
      .mockResolvedValue(consolidationOrder);
    const results = await repo.read(consolidationId);

    expect(results).toEqual(consolidationOrder);
    expect(findOneSpy).toHaveBeenCalled();
  });

  test('should call insertOne when calling create on the repo', async () => {
    const consolidationOrder = MockData.getConsolidationOrder({ override: { consolidationId } });
    const insertOneSpy = jest
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
    const createManySpy = jest
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
      const createManySpy = jest
        .spyOn(MongoCollectionAdapter.prototype, 'insertMany')
        .mockRejectedValue('This should not throw.');
      await repo.createMany(list);

      expect(createManySpy).not.toHaveBeenCalled();
    },
  );

  describe('error handling', () => {
    const error = new Error('some error');
    const camsError = getCamsError(error, 'COSMOS_DB_REPOSITORY_CONSOLIDATION_ORDERS');

    test('should properly handle error when calling search', async () => {
      const consolidationOrder = MockData.getConsolidationOrder({
        override: { consolidationId, courtDivisionCode: '081' },
      });
      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(error);
      await expect(() =>
        repo.search({
          divisionCodes: ['081'],
          consolidationId: consolidationOrder.consolidationId,
        }),
      ).rejects.toThrow(camsError);
    });

    test('should properly handle error when calling delete', async () => {
      jest.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockRejectedValue(error);

      await expect(() => repo.delete(consolidationId)).rejects.toThrow(camsError);
    });

    test('should properly handle error when calling read', async () => {
      jest.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(error);
      await expect(() => repo.read(consolidationId)).rejects.toThrow(camsError);
    });

    test('should properly handle error when calling create', async () => {
      const consolidationOrder = MockData.getConsolidationOrder({ override: { consolidationId } });
      jest.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(camsError);
      await expect(() => repo.create(consolidationOrder)).rejects.toThrow(camsError);
    });

    test('should properly handle Error when calling createMany', async () => {
      const consolidationOrders = MockData.buildArray(MockData.getConsolidationOrder, 3);
      jest.spyOn(MongoCollectionAdapter.prototype, 'insertMany').mockRejectedValue(error);
      await expect(() => repo.createMany(consolidationOrders)).rejects.toThrow(camsError);
    });
  });
});
