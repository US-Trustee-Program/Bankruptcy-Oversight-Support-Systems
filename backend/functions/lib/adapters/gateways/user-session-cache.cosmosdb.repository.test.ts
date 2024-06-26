import { ApplicationContext } from '../types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import {
  CachedCamsSession,
  UserSessionCacheCosmosDbRepository,
} from './user-session-cache.cosmosdb.repository';
import { MockHumbleItems, MockHumbleQuery } from '../../testing/mock.cosmos-client-humble';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { CamsJwtClaims } from '../types/authorization';

describe('User session cache Cosmos repository tests', () => {
  let context: ApplicationContext;
  let repo: UserSessionCacheCosmosDbRepository;
  const expected = MockData.getCamsSession();

  beforeEach(async () => {
    context = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    repo = new UserSessionCacheCosmosDbRepository(context);
    jest.clearAllMocks();
  });

  test('get should throw for invalid token', async () => {
    const fetchAllSpy = jest.spyOn(MockHumbleQuery.prototype, 'fetchAll');
    await expect(repo.get(context, 'invalid.token')).rejects.toThrow('Invalid token received.');
    expect(fetchAllSpy).not.toHaveBeenCalled();
  });

  test('get should return null on cache miss', async () => {
    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({ resources: [] });
    const actual = await repo.get(context, 'a.valid.token');
    expect(actual).toBeNull();
  });

  test('get should return null if multiple cache hits', async () => {
    jest
      .spyOn(MockHumbleQuery.prototype, 'fetchAll')
      .mockResolvedValue({ resources: [expected, MockData.getCamsSession()] });
    const actual = await repo.get(context, 'a.valid.token');
    expect(actual).toBeNull();
  });

  test('get should return CamsSession on cache hit', async () => {
    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({ resources: [expected] });
    const actual = await repo.get(context, 'a.valid.token');
    expect(actual).toEqual(expected);
  });

  test('put should throw for invalid token', async () => {
    const newSession = { ...expected, apiToken: 'invalid.token' };
    const createSpy = jest.spyOn(MockHumbleItems.prototype, 'create');
    await expect(repo.put(context, newSession)).rejects.toThrow('Invalid token received.');
    expect(createSpy).not.toHaveBeenCalled();
  });

  test('put should return CamsSession and create valid ttl on success', async () => {
    const newSession = { ...expected };
    const camsJwtClaims = JSON.parse(
      Buffer.from(newSession.apiToken.split('.')[1], 'base64').toString(),
    ) as unknown as CamsJwtClaims;
    const createSpy = jest
      .spyOn(MockHumbleItems.prototype, 'create')
      .mockResolvedValue({ resource: expected });
    const actual = await repo.put(context, newSession);
    expect(actual).toEqual(newSession);
    const argument = createSpy.mock.calls[0][0] as CachedCamsSession;
    expect(createSpy).toHaveBeenCalledWith({
      ...newSession,
      signature: expect.any(String),
      ttl: expect.any(Number),
    });
    const maxTtl = Math.floor(camsJwtClaims.exp - Date.now() / 1000);
    expect(argument.ttl).toBeLessThan(maxTtl + 1);
  });
});
