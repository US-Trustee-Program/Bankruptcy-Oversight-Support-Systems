import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { HumbleQuery } from '../../../testing/mock.cosmos-client-humble';
import { getCosmosCrudRepository } from '../../../factory';

describe('Test generic cosmosdb repository', () => {
  type DummyItemType = {
    id: 'myid';
    something: 'here';
  };

  let applicationContext;
  let repository;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext({
      DATABASE_MOCK: 'true',
    });
    repository = getCosmosCrudRepository<DummyItemType>(
      applicationContext,
      'randomitem',
      'randommodule',
    );
  });

  test('should get a list of orders', async () => {
    const mockItems = [
      {
        id: '123',
        something: '456',
      },
    ];
    const mockFetchAll = jest.spyOn(HumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: mockItems,
    });

    const testResult = await repository.getAll(applicationContext);
    expect(testResult).toEqual(mockItems);
    expect(mockFetchAll).toHaveBeenCalled();
  });
});
