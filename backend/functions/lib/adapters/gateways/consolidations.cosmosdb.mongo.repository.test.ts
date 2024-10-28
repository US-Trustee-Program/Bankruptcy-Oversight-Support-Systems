import { ApplicationContext } from '../types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import ConsolidationOrdersCosmosMongoDbRepository from './consolidations.cosmosdb.mongo.repository';
import { MongoCollectionAdapter } from './mongo/mongo-adapter';
import QueryBuilder from '../../query/query-builder';
import { closeDeferred } from '../../defer-close';

describe('Consolidations Repository tests', () => {
  let context: ApplicationContext;
  let repo: ConsolidationOrdersCosmosMongoDbRepository;
  const { and, contains, equals, orderBy } = QueryBuilder;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = new ConsolidationOrdersCosmosMongoDbRepository(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    jest.restoreAllMocks();
  });

  test('should search on consolidations by court division code or consolidationId', async () => {
    const consolidationId = '823688b3-9e0f-4a02-a7cb-89380e6ad19e';
    const consolidationOrder = MockData.getConsolidationOrder({
      override: { consolidationId, courtDivisionCode: '081' },
    });
    const findSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue([consolidationOrder]);
    const query = QueryBuilder.build(
      and(
        contains<string[]>('courtDivisionCode', [consolidationOrder.courtDivisionCode]),
        equals<string>('consolidationId', consolidationOrder.consolidationId),
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

  test('should call delete on a consolidation order', async () => {
    const consolidationId = '823688b3-9e0f-4a02-a7cb-89380e6ad19e';
    const deleteSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'deleteOne')
      .mockResolvedValue(1);

    await repo.delete(consolidationId);
    expect(deleteSpy).toHaveBeenCalled();
    // expect(resultCount).toEqual(1);
  });

  test('should call read and get consolidation by consolidationId', async () => {
    const consolidationId = '823688b3-9e0f-4a02-a7cb-89380e6ad19e';
    const consolidationOrder = MockData.getConsolidationOrder({ override: { consolidationId } });
    const findOneSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'findOne')
      .mockResolvedValue(consolidationOrder);
    const results = await repo.read(consolidationId);

    expect(results).toEqual(consolidationOrder);
    expect(findOneSpy).toHaveBeenCalled();
  });

  test('should call insertOne when calling create on the repo', async () => {
    const consolidationId = '823688b3-9e0f-4a02-a7cb-89380e6ad19e';
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
    const results = await repo.createMany(consolidationOrders);

    expect(results).toEqual(consolidationIds);
    expect(createManySpy).toHaveBeenCalledWith(consolidationOrders);
  });
});
