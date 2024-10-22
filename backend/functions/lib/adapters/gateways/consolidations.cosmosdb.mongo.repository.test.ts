import { ApplicationContext } from '../types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OrdersSearchPredicate } from '../../../../../common/src/api/search';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import ConsolidationOrdersCosmosMongoDbRepository from './consolidations.cosmosdb.mongo.repository';

describe('Consolidations Repository tests', () => {
  let context: ApplicationContext;
  let repo: ConsolidationOrdersCosmosMongoDbRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = new ConsolidationOrdersCosmosMongoDbRepository(context);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (repo) await repo.close();
  });

  /*
  test('should find all', async () => {
    const consolidationOrders = MockData.buildArray(MockData.getConsolidationOrder, 5);
    const fetchAllSpy = jest
      .spyOn(MockHumbleQuery.prototype, 'fetchAll')
      .mockResolvedValue({ resources: consolidationOrders });
    const querySpy = jest.spyOn(CosmosDbRepository.prototype, 'query');

    const actual = await repo.search(context);

    expect(actual).toEqual(consolidationOrders);
    expect(fetchAllSpy).toHaveBeenCalled();
    expect(querySpy).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ query: expect.any(String), parameters: [] }),
    );
    expect(querySpy.mock.calls[0][1]['query']).not.toContain('WHERE');
    expect(querySpy.mock.calls[0][1]['query']).toContain('ORDER BY');
  });

  test('should query by predicate', async () => {
    const consolidationOrders = MockData.buildArray(MockData.getConsolidationOrder, 5);
    jest
      .spyOn(MockHumbleQuery.prototype, 'fetchAll')
      .mockResolvedValue({ resources: consolidationOrders });
    const querySpy = jest.spyOn(CosmosDbRepository.prototype, 'query');

    const predicate: OrdersSearchPredicate = {
      divisionCodes: ['one', 'two'],
    };

    const actual = await repo.search(context, predicate);

    expect(actual).toEqual(consolidationOrders);
    expect(querySpy).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ query: expect.any(String), parameters: [] }),
    );
    expect(querySpy.mock.calls[0][1]['query']).toContain('WHERE');
    expect(querySpy.mock.calls[0][1]['query']).toContain('one');
    expect(querySpy.mock.calls[0][1]['query']).toContain('OR');
    expect(querySpy.mock.calls[0][1]['query']).toContain('two');
    expect(querySpy.mock.calls[0][1]['query']).toContain('ORDER BY');
  });
  */

  test('should create a consolidation and then delete it', async () => {
    const consolidationOrder = MockData.getConsolidationOrder();

    await repo.create(context, consolidationOrder);
    const results = await repo.search(context, {
      consolidationId: consolidationOrder.consolidationId,
    });

    expect(results).toBeDefined();
    expect(results.length).toEqual(1);

    const inserted = results[0];

    await repo.delete(context, inserted.id, consolidationOrder.consolidationId);
    const predicate: OrdersSearchPredicate = {
      consolidationId: consolidationOrder.consolidationId,
    };
    const record = await repo.search(context, predicate);
    expect(record).toEqual([]);
  });

  test('should get a consolidation by consolidationId', async () => {
    const results = await repo.search(context, {
      consolidationId: '823688b3-9e0f-4a02-a7cb-89380e6ad19e',
    });

    expect(results).toBeDefined();
    expect(results.length).toEqual(1);
  });
});
