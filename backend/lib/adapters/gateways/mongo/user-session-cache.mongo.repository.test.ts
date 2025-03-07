import * as jwt from 'jsonwebtoken';
import { ApplicationContext } from '../../types/basic';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import {
  CachedCamsSession,
  UserSessionCacheMongoRepository,
} from './user-session-cache.mongo.repository';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { CamsJwtClaims } from '../../../../../common/src/cams/jwt';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';
import QueryBuilder from '../../../query/query-builder';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { nowInSeconds } from '../../../../../common/src/date-helper';
import { CamsSession } from '../../../../../common/src/cams/session';

describe('User session cache Cosmos repository tests', () => {
  let context: ApplicationContext;
  let repo: UserSessionCacheMongoRepository;
  let expectedSession: CamsSession;
  const { equals } = QueryBuilder;

  beforeEach(async () => {
    expectedSession = MockData.getCamsSession();
    context = await createMockApplicationContext();
    repo = UserSessionCacheMongoRepository.getInstance(context);
    jest.resetAllMocks();
  });

  afterEach(async () => {
    repo.release();
    await closeDeferred(context);
  });

  test('read should throw for invalid token', async () => {
    const find = jest.spyOn(MongoCollectionAdapter.prototype, 'find');
    await expect(repo.read('invalid.token')).rejects.toThrow('Invalid token received.');
    expect(find).not.toHaveBeenCalled();
  });

  test('read should throw error on cache miss', async () => {
    jest
      .spyOn(MongoCollectionAdapter.prototype, 'findOne')
      .mockRejectedValue(new NotFoundError(''));
    await expect(repo.read('a.valid.token')).rejects.toThrow('Not found');
  });

  test('read should return CamsSession on cache hit', async () => {
    const session = { ...expectedSession, id: 'some-id', signature: 'some signature', ttl: 42 };
    jest.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(session);
    const actual = await repo.read('a.valid.token');
    expect(actual).toEqual(expectedSession);
    expect(actual).not.toEqual(
      expect.objectContaining({
        id: expect.anything(),
        signature: expect.anything(),
        ttl: expect.any(Number),
      }),
    );
  });

  test('upsert should throw for invalid token', async () => {
    const newSession = { ...expectedSession, accessToken: 'invalid.token' };
    const insertOne = jest.spyOn(MongoCollectionAdapter.prototype, 'insertOne');
    await expect(repo.upsert(newSession)).rejects.toThrow('Invalid token received.');
    expect(insertOne).not.toHaveBeenCalled();
  });

  test('upsert should return CamsSession and create valid ttl on success', async () => {
    const newSession = { ...expectedSession };
    const camsJwtClaims = jwt.decode(newSession.accessToken) as CamsJwtClaims;
    const replaceSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockResolvedValue({ id: 'oid-guid', modifiedCount: 1, upsertedCount: 0 });
    const tokenParts = newSession.accessToken.split('.');
    const signature = tokenParts[2];
    const expectedQuery = QueryBuilder.build(equals('signature', signature));
    const expectedTtl = Math.floor(camsJwtClaims.exp - nowInSeconds());

    const actual = await repo.upsert(newSession);
    expect(actual).toEqual(newSession);
    expect(replaceSpy).toHaveBeenCalledWith(
      expectedQuery,
      expect.objectContaining({
        ...newSession,
        signature: expect.anything(),
        ttl: expect.any(Number),
      }),
      true,
    );
    const argument = replaceSpy.mock.calls[0][1] as CachedCamsSession;
    expect(argument.ttl).toBeLessThan(expectedTtl + 5);
    expect(argument.ttl).toBeGreaterThan(expectedTtl - 5);
  });

  test('upsert should throw when replaceOne fails', async () => {
    const newSession = { ...expectedSession };
    jest
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockRejectedValue(new Error('some error'));

    await expect(repo.upsert(newSession)).rejects.toThrow();
  });
});
