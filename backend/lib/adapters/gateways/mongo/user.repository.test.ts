import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { UsersMongoRepository } from './user.repository';
import { ApplicationContext } from '../../types/basic';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { UnknownError } from '../../../common-errors/unknown-error';
import { closeDeferred } from '../../../deferrable/defer-close';
import { getTodaysIsoDate } from '../../../../../common/src/date-helper';

describe('User repository tests', () => {
  let context: ApplicationContext;
  let repo: UsersMongoRepository;
  const todayDate = getTodaysIsoDate();
  const adminUser = MockData.getCamsUserReference();

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = UsersMongoRepository.getInstance(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    jest.restoreAllMocks();
    repo.release();
  });

  const successfulPutCases = [
    ['create', 0, 1],
    ['update', 1, 0],
  ];
  test.each(successfulPutCases)(
    'should %s Privileged Identity user',
    async (_caseName: string, modifiedCount: number, upsertedCount: number) => {
      const user = MockData.getPrivilegedIdentityUser();
      const replaceOneSpy = jest
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValue({ id: user.id, modifiedCount, upsertedCount });

      const actual = await repo.putPrivilegedIdentityUser(user, adminUser);
      expect(actual).toEqual({
        id: user.id,
        modifiedCount,
        upsertedCount,
      });
      expect(replaceOneSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ ...user, updatedBy: adminUser, updatedOn: expect.any(String) }),
        true,
      );
    },
  );

  const unknownErrorPutCases = [
    ['no changes', 0, 0],
    ['too many changes', 1, 1],
  ];
  test.each(unknownErrorPutCases)(
    'should throw UnknownError for %s',
    async (_caseName: string, modifiedCount: number, upsertedCount: number) => {
      const user = MockData.getPrivilegedIdentityUser();
      jest
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValue({ id: user.id, modifiedCount, upsertedCount });

      const expected = new UnknownError(expect.anything(), {
        message: `While upserting privileged identity user ${user.id}, we modified ${modifiedCount} and created ${upsertedCount} documents.`,
      });
      await expect(repo.putPrivilegedIdentityUser(user, adminUser)).rejects.toThrow(expected);
    },
  );

  test('should throw unknown error', async () => {
    const user = MockData.getPrivilegedIdentityUser();
    jest.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockRejectedValue(new Error());

    const expected = new UnknownError(expect.anything(), {
      message: `Failed to write privileged identity user ${user.id}.`,
    });
    await expect(repo.putPrivilegedIdentityUser(user, adminUser)).rejects.toThrow(expected);
  });

  test('should return privileged identity user', async () => {
    const user = MockData.getPrivilegedIdentityUser();
    jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([user]);

    const actual = await repo.getPrivilegedIdentityUser('test-user');
    expect(actual).toEqual(user);
  });

  test('should throw not found error for an empty array', async () => {
    jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);

    const expected = new NotFoundError(expect.anything());
    await expect(repo.getPrivilegedIdentityUser('test-user')).rejects.toThrow(expected);
  });

  test('should throw not found error for an undefined response', async () => {
    jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(undefined);

    const expected = new NotFoundError(expect.anything());
    await expect(repo.getPrivilegedIdentityUser('test-user')).rejects.toThrow(expected);
  });

  test('should delete privileged identity user', async () => {
    const deleteSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'deleteOne')
      .mockResolvedValue(1);

    await repo.deletePrivilegedIdentityUser('test-user');
    expect(deleteSpy).toHaveBeenCalled();
  });

  test('should throw when deleting privileged identity user errors', async () => {
    const deleteSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'deleteOne')
      .mockRejectedValue(new Error('some unknown error'));

    const expected = new UnknownError(expect.anything(), {
      message: 'Failed to delete privileged identity user test-user.',
    });
    await expect(repo.deletePrivilegedIdentityUser('test-user')).rejects.toThrow(expected);
    expect(deleteSpy).toHaveBeenCalled();
  });

  test('should throw when deleting privileged identity user deletes too many items', async () => {
    const deleteSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'deleteOne')
      .mockRejectedValue(new Error('some unknown error'));

    const expected = new UnknownError(expect.anything(), {
      message: 'Failed to delete privileged identity user test-user.',
    });
    await expect(repo.deletePrivilegedIdentityUser('test-user')).rejects.toThrow(expected);
    expect(deleteSpy).toHaveBeenCalled();
  });

  test('should throw when expired privileged identity user is excluded', async () => {
    const user = MockData.getPrivilegedIdentityUser({
      expires: MockData.someDateBeforeThisDate(new Date(todayDate).toISOString(), 2),
    });
    jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([user]);

    await expect(repo.getPrivilegedIdentityUser('test-user', false)).rejects.toThrow(
      'Expired elevation found.',
    );
  });
});

describe('UsersMongoRepository singleton handling', () => {
  let context: ApplicationContext;
  beforeEach(async () => {
    context = await createMockApplicationContext();
    // Reset singleton state for isolation
    UsersMongoRepository['instance'] = null;
    UsersMongoRepository['referenceCount'] = 0;
  });

  test('getInstance returns the same instance and increments referenceCount', () => {
    const repo1 = UsersMongoRepository.getInstance(context);
    const repo2 = UsersMongoRepository.getInstance(context);
    expect(repo1).toBe(repo2);
    expect(UsersMongoRepository['referenceCount']).toBe(2);
  });

  test('dropInstance decrements referenceCount and closes client at zero', async () => {
    const repo = UsersMongoRepository.getInstance(context);
    UsersMongoRepository.getInstance(context); // refCount = 2
    // Mock client.close
    const closeSpy = jest.spyOn(repo['client'], 'close').mockResolvedValue(undefined);
    UsersMongoRepository.dropInstance(); // refCount = 1
    expect(UsersMongoRepository['referenceCount']).toBe(1);
    expect(closeSpy).not.toHaveBeenCalled();
    UsersMongoRepository.dropInstance(); // refCount = 0
    expect(UsersMongoRepository['referenceCount']).toBe(0);
    // Wait for .then() in dropInstance
    await Promise.resolve();
    expect(closeSpy).toHaveBeenCalled();
    expect(UsersMongoRepository['instance']).toBeNull();
  });

  test('dropInstance does nothing if referenceCount is already zero', async () => {
    // No instance created
    expect(UsersMongoRepository['referenceCount']).toBe(0);
    expect(UsersMongoRepository['instance']).toBeNull();
    // Should not throw or call close
    expect(() => UsersMongoRepository.dropInstance()).not.toThrow();
    expect(UsersMongoRepository['referenceCount']).toBe(0);
    expect(UsersMongoRepository['instance']).toBeNull();
  });

  test('release calls dropInstance', () => {
    const repo = UsersMongoRepository.getInstance(context);
    const dropSpy = jest.spyOn(UsersMongoRepository, 'dropInstance');
    repo.release();
    expect(dropSpy).toHaveBeenCalled();
  });
});
