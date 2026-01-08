import { vi } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { ApplicationContext } from '../../types/basic';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import {
  CachedCamsSession,
  UserSessionCacheMongoRepository,
} from './user-session-cache.mongo.repository';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsJwtClaims } from '@common/cams/jwt';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';
import QueryBuilder from '../../../query/query-builder';
import { NotFoundError } from '../../../common-errors/not-found-error';
import DateHelper from '@common/date-helper';

describe('User session cache Cosmos repository tests', () => {
  let context: ApplicationContext;
  let repo: UserSessionCacheMongoRepository;
  const expected = MockData.getCamsSession();

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = UserSessionCacheMongoRepository.getInstance(context);
    vi.resetAllMocks();
  });

  afterEach(async () => {
    repo.release();
    await closeDeferred(context);
  });

  test('read should throw for invalid token', async () => {
    const find = vi.spyOn(MongoCollectionAdapter.prototype, 'find');
    await expect(repo.read('invalid.token')).rejects.toThrow('Invalid token received.');
    expect(find).not.toHaveBeenCalled();
  });

  test('read should throw error on cache miss', async () => {
    vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(new NotFoundError(''));
    await expect(repo.read('a.valid.token')).rejects.toThrow('Not found');
  });

  test('read should return CamsSession on cache hit', async () => {
    const session = { ...expected, id: 'some-id', signature: 'some signature', ttl: 42 };
    vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(session);
    const actual = await repo.read('a.valid.token');
    expect(actual).toEqual(expected);
    expect(actual).not.toEqual(
      expect.objectContaining({
        id: expect.anything(),
        signature: expect.anything(),
        ttl: expect.any(Number),
      }),
    );
  });

  test('upsert should throw for invalid token', async () => {
    const newSession = { ...expected, accessToken: 'invalid.token' };
    const insertOne = vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne');
    await expect(repo.upsert(newSession)).rejects.toThrow('Invalid token received.');
    expect(insertOne).not.toHaveBeenCalled();
  });

  test('upsert should return CamsSession and create valid ttl on success', async () => {
    const newSession = { ...expected };
    const camsJwtClaims = jwt.decode(newSession.accessToken) as CamsJwtClaims;
    const replaceSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockResolvedValue({ id: 'oid-guid', modifiedCount: 1, upsertedCount: 0 });
    const tokenParts = newSession.accessToken.split('.');
    const signature = tokenParts[2];

    const expectedTtl = Math.floor(camsJwtClaims.exp - DateHelper.nowInSeconds());

    const doc = QueryBuilder.using<CachedCamsSession>();
    const expectedQuery = doc('signature').equals(signature);

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
    const newSession = { ...expected };
    vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockRejectedValue(
      new Error('some error'),
    );

    await expect(repo.upsert(newSession)).rejects.toThrow();
  });
});

describe('UserSessionCacheMongoRepository singleton handling', () => {
  let context: ApplicationContext;
  beforeEach(async () => {
    context = await createMockApplicationContext();
    // Reset singleton state for isolation
    UserSessionCacheMongoRepository['instance'] = null;
    UserSessionCacheMongoRepository['referenceCount'] = 0;
  });

  test('getInstance returns the same instance and increments referenceCount', () => {
    const repo1 = UserSessionCacheMongoRepository.getInstance(context);
    const repo2 = UserSessionCacheMongoRepository.getInstance(context);
    expect(repo1).toBe(repo2);
    expect(UserSessionCacheMongoRepository['referenceCount']).toBe(2);
  });

  test('dropInstance decrements referenceCount and closes client at zero', async () => {
    const repo = UserSessionCacheMongoRepository.getInstance(context);
    UserSessionCacheMongoRepository.getInstance(context); // refCount = 2
    // Mock client.close
    const closeSpy = vi.spyOn(repo['client'], 'close').mockResolvedValue(undefined);
    UserSessionCacheMongoRepository.dropInstance(); // refCount = 1
    expect(UserSessionCacheMongoRepository['referenceCount']).toBe(1);
    expect(closeSpy).not.toHaveBeenCalled();
    UserSessionCacheMongoRepository.dropInstance(); // refCount = 0
    expect(UserSessionCacheMongoRepository['referenceCount']).toBe(0);
    // Wait for .then() in dropInstance
    await Promise.resolve();
    expect(closeSpy).toHaveBeenCalled();
    expect(UserSessionCacheMongoRepository['instance']).toBeNull();
  });

  test('dropInstance does nothing if referenceCount is already zero', async () => {
    // No instance created
    expect(UserSessionCacheMongoRepository['referenceCount']).toBe(0);
    expect(UserSessionCacheMongoRepository['instance']).toBeNull();
    // Should not throw or call close
    expect(() => UserSessionCacheMongoRepository.dropInstance()).not.toThrow();
    expect(UserSessionCacheMongoRepository['referenceCount']).toBe(0);
    expect(UserSessionCacheMongoRepository['instance']).toBeNull();
  });

  test('release calls dropInstance', () => {
    const repo = UserSessionCacheMongoRepository.getInstance(context);
    const dropSpy = vi.spyOn(UserSessionCacheMongoRepository, 'dropInstance');
    repo.release();
    expect(dropSpy).toHaveBeenCalled();
  });
});
