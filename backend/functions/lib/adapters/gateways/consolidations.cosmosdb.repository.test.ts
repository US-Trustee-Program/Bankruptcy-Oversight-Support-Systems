import { ApplicationContext } from '../types/basic';
import ConsolidationOrdersCosmosDbRepository from './consolidations.cosmosdb.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OrdersSearchPredicate } from '../../../../../common/src/api/search';
import { MockHumbleQuery } from '../../testing/mock.cosmos-client-humble';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { CosmosDbRepository } from './cosmos/cosmos.repository';

describe('Consolidations Repository tests', () => {
  let context: ApplicationContext;
  let repo: ConsolidationOrdersCosmosDbRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = new ConsolidationOrdersCosmosDbRepository(context);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

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
});
