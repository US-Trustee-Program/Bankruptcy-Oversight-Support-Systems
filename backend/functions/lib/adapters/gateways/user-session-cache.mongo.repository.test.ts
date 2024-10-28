import * as jwt from 'jsonwebtoken';
import { ApplicationContext } from '../types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import {
  CachedCamsSession,
  UserSessionCacheMongoRepository,
} from './user-session-cache.mongo.repository';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { CamsJwtClaims } from '../../../../../common/src/cams/jwt';
import { MongoCollectionAdapter } from './mongo/mongo-adapter';
import { closeDeferred } from '../../defer-close';

describe('User session cache Cosmos repository tests', () => {
  let context: ApplicationContext;
  let repo: UserSessionCacheMongoRepository;
  const expected = MockData.getCamsSession();

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = new UserSessionCacheMongoRepository(context);
    jest.resetAllMocks();
  });

  afterEach(async () => {
    await closeDeferred(context);
  });

  test('read should throw for invalid token', async () => {
    const find = jest.spyOn(MongoCollectionAdapter.prototype, 'find');
    await expect(repo.read('invalid.token')).rejects.toThrow('Invalid token received.');
    expect(find).not.toHaveBeenCalled();
  });

  test('read should throw error on cache miss', async () => {
    jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);
    await expect(repo.read('a.valid.token')).rejects.toThrow('Session not found or is ambiguous.');
  });

  test('read should throw if multiple cache hits', async () => {
    jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue([expected, MockData.getCamsSession()]);
    await expect(repo.read('a.valid.token')).rejects.toThrow('Session not found or is ambiguous.');
  });

  test('read should return CamsSession on cache hit', async () => {
    jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([expected]);
    const actual = await repo.read('a.valid.token');
    expect(actual).toEqual(expected);
  });

  test('upsert should throw for invalid token', async () => {
    const newSession = { ...expected, accessToken: 'invalid.token' };
    const insertOne = jest.spyOn(MongoCollectionAdapter.prototype, 'insertOne');
    await expect(repo.upsert(newSession)).rejects.toThrow('Invalid token received.');
    expect(insertOne).not.toHaveBeenCalled();
  });

  test('upsert should return CamsSession and create valid ttl on success', async () => {
    const newSession = { ...expected };
    const camsJwtClaims = jwt.decode(newSession.accessToken) as CamsJwtClaims;
    const insertOne = jest
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockResolvedValue('oid-guid');

    const actual = await repo.upsert(newSession);

    expect(actual).toEqual(newSession);
    const argument = insertOne.mock.calls[0][0] as CachedCamsSession;
    expect(insertOne).toHaveBeenCalledWith({
      ...newSession,
      signature: expect.any(String),
      ttl: expect.any(Number),
    });
    const maxTtl = Math.floor(camsJwtClaims.exp - Date.now() / 1000);
    expect(argument.ttl).toBeLessThan(maxTtl + 1);
  });
});
