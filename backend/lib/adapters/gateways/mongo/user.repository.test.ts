import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { UsersMongoRepository } from './user.repository';
import { ApplicationContext } from '../../types/basic';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { UnknownError } from '../../../common-errors/unknown-error';
import { closeDeferred } from '../../../deferrable/defer-close';

describe('User repository tests', () => {
  let context: ApplicationContext;
  let repo: UsersMongoRepository;

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
      jest
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValue({ id: user.id, modifiedCount, upsertedCount });

      const actual = await repo.putPrivilegedIdentityUser(user);
      expect(actual).toEqual({
        id: user.id,
        modifiedCount,
        upsertedCount,
      });
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
      await expect(repo.putPrivilegedIdentityUser(user)).rejects.toThrow(expected);
    },
  );

  test('should throw unknown error', async () => {
    const user = MockData.getPrivilegedIdentityUser();
    jest.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockRejectedValue(new Error());

    const expected = new UnknownError(expect.anything(), {
      message: `Failed to write privileged identity user ${user.id}.`,
    });
    await expect(repo.putPrivilegedIdentityUser(user)).rejects.toThrow(expected);
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
});
