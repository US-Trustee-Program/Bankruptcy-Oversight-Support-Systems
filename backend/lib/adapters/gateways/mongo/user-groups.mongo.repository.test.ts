import { vi } from 'vitest';
import { UserGroupDocument, UserGroupsMongoRepository } from './user-groups.mongo.repository';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { closeDeferred } from '../../../deferrable/defer-close';
import { CamsError } from '../../../common-errors/cams-error';
import { randomUUID } from 'node:crypto';
import { UserGroup } from '../../../../../common/src/cams/users';

describe('UserGroupsMongoRepository', () => {
  let context: ApplicationContext;
  let repo: UserGroupsMongoRepository;

  beforeAll(async () => {
    context = await createMockApplicationContext();
  });

  beforeEach(async () => {
    repo = UserGroupsMongoRepository.getInstance(context);
    await createMockApplicationContextSession();
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.restoreAllMocks();
    repo.release();
  });

  describe('getInstance', () => {
    test('should return singleton instance', () => {
      const instance1 = UserGroupsMongoRepository.getInstance(context);
      const instance2 = UserGroupsMongoRepository.getInstance(context);
      expect(instance1).toBe(instance2);
      instance1.release();
      instance2.release();
    });

    test('should increment reference count on getInstance', () => {
      const instance1 = UserGroupsMongoRepository.getInstance(context);
      const instance2 = UserGroupsMongoRepository.getInstance(context);
      const instance3 = UserGroupsMongoRepository.getInstance(context);

      // All should be same instance
      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);

      // Release all instances
      instance1.release();
      instance2.release();
      instance3.release();
    });
  });

  describe('dropInstance', () => {
    test('should decrement reference count on dropInstance', () => {
      const _instance1 = UserGroupsMongoRepository.getInstance(context);
      const _instance2 = UserGroupsMongoRepository.getInstance(context);

      UserGroupsMongoRepository.dropInstance();
      UserGroupsMongoRepository.dropInstance();

      // After all references dropped, new getInstance should create new instance
      const instance3 = UserGroupsMongoRepository.getInstance(context);
      expect(instance3).toBeDefined();
      instance3.release();
    });

    test('should not close client when reference count is still positive', () => {
      const instance1 = UserGroupsMongoRepository.getInstance(context);
      const _instance2 = UserGroupsMongoRepository.getInstance(context);
      const closeSpy = vi.spyOn(instance1['client'], 'close').mockResolvedValue();

      UserGroupsMongoRepository.dropInstance();

      expect(closeSpy).not.toHaveBeenCalled();

      // Clean up remaining reference
      UserGroupsMongoRepository.dropInstance();
    });
  });

  describe('release', () => {
    test('should call dropInstance', () => {
      const dropInstanceSpy = vi.spyOn(UserGroupsMongoRepository, 'dropInstance');
      repo.release();
      expect(dropInstanceSpy).toHaveBeenCalled();
    });
  });

  describe('upsertUserGroupsBatch', () => {
    test('should upsert user groups successfully', async () => {
      const userGroups: UserGroupDocument[] = [
        {
          id: randomUUID(),
          groupName: 'USTP CAMS Trial Attorney',
          users: MockData.buildArray(MockData.getCamsUserReference, 3),
          documentType: 'USER_GROUP',
        },
        {
          id: randomUUID(),
          groupName: 'USTP CAMS Auditor',
          users: MockData.buildArray(MockData.getCamsUserReference, 2),
          documentType: 'USER_GROUP',
        },
      ];

      const bulkReplaceSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'bulkReplace')
        .mockResolvedValue({
          id: 'bulk-result-id',
          insertedCount: 0,
          matchedCount: 2,
          modifiedCount: 2,
          deletedCount: 0,
          upsertedCount: 0,
          upsertedIds: {},
          insertedIds: {},
        });

      await repo.upsertUserGroupsBatch(context, userGroups);

      expect(bulkReplaceSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          {
            filter: expect.objectContaining({
              condition: 'EQUALS',
              rightOperand: 'USTP CAMS Trial Attorney',
            }),
            replacement: expect.objectContaining({
              groupName: 'USTP CAMS Trial Attorney',
              documentType: 'USER_GROUP',
            }),
          },
          {
            filter: expect.objectContaining({
              condition: 'EQUALS',
              rightOperand: 'USTP CAMS Auditor',
            }),
            replacement: expect.objectContaining({
              groupName: 'USTP CAMS Auditor',
              documentType: 'USER_GROUP',
            }),
          },
        ]),
      );
    });

    test('should log info message with upsert counts', async () => {
      const userGroups: UserGroup[] = [
        {
          id: randomUUID(),
          groupName: 'USTP CAMS Trial Attorney',
          users: MockData.buildArray(MockData.getCamsUserReference, 3),
        },
      ];

      vi.spyOn(MongoCollectionAdapter.prototype, 'bulkReplace').mockResolvedValue({
        id: 'bulk-result-id',
        insertedCount: 0,
        matchedCount: 0,
        modifiedCount: 0,
        deletedCount: 0,
        upsertedCount: 1,
        upsertedIds: {},
        insertedIds: {},
      });

      const loggerSpy = vi.spyOn(context.logger, 'info');

      await repo.upsertUserGroupsBatch(context, userGroups);

      expect(loggerSpy).toHaveBeenCalledWith(
        'USER-GROUPS-MONGO-REPOSITORY',
        'Bulk upsert completed: 1 inserted, 0 updated',
      );
    });

    test('should return early when user groups array is empty', async () => {
      const bulkReplaceSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'bulkReplace');
      const loggerSpy = vi.spyOn(context.logger, 'info');

      await repo.upsertUserGroupsBatch(context, []);

      expect(bulkReplaceSpy).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        'USER-GROUPS-MONGO-REPOSITORY',
        'No user groups to upsert',
      );
    });

    test('should throw CamsError when bulkReplace operation fails', async () => {
      const userGroups: UserGroup[] = [
        {
          id: randomUUID(),
          groupName: 'USTP CAMS Trial Attorney',
          users: MockData.buildArray(MockData.getCamsUserReference, 3),
        },
      ];

      const dbError = new Error('Bulk replace operation failed');
      vi.spyOn(MongoCollectionAdapter.prototype, 'bulkReplace').mockRejectedValue(dbError);

      await expect(repo.upsertUserGroupsBatch(context, userGroups)).rejects.toThrow(CamsError);
      await expect(repo.upsertUserGroupsBatch(context, userGroups)).rejects.toMatchObject({
        message: 'Failed to upsert user groups batch.',
        module: 'USER-GROUPS-MONGO-REPOSITORY',
      });
    });

    test('should handle multiple groups with correct filter and replacement', async () => {
      const userGroups: UserGroup[] = [
        {
          id: randomUUID(),
          groupName: 'Group A',
          users: [MockData.getCamsUserReference()],
        },
        {
          id: randomUUID(),
          groupName: 'Group B',
          users: [MockData.getCamsUserReference()],
        },
        {
          id: randomUUID(),
          groupName: 'Group C',
          users: [MockData.getCamsUserReference()],
        },
      ];

      const bulkReplaceSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'bulkReplace')
        .mockResolvedValue({
          id: 'bulk-result-id',
          insertedCount: 0,
          matchedCount: 3,
          modifiedCount: 3,
          deletedCount: 0,
          upsertedCount: 0,
          upsertedIds: {},
          insertedIds: {},
        });

      await repo.upsertUserGroupsBatch(context, userGroups);

      expect(bulkReplaceSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          {
            filter: expect.objectContaining({
              condition: 'EQUALS',
              rightOperand: 'Group A',
            }),
            replacement: expect.objectContaining({
              groupName: 'Group A',
              documentType: 'USER_GROUP',
            }),
          },
          {
            filter: expect.objectContaining({
              condition: 'EQUALS',
              rightOperand: 'Group B',
            }),
            replacement: expect.objectContaining({
              groupName: 'Group B',
              documentType: 'USER_GROUP',
            }),
          },
          {
            filter: expect.objectContaining({
              condition: 'EQUALS',
              rightOperand: 'Group C',
            }),
            replacement: expect.objectContaining({
              groupName: 'Group C',
              documentType: 'USER_GROUP',
            }),
          },
        ]),
      );
    });
  });

  describe('getUserGroupsByNames', () => {
    test('should query user-groups collection with CONTAINS condition', async () => {
      const groupNames = ['USTP CAMS Trial Attorney', 'USTP CAMS Auditor'];
      const mockGroups: UserGroupDocument[] = [
        {
          id: randomUUID(),
          groupName: 'USTP CAMS Trial Attorney',
          users: [MockData.getCamsUserReference()],
          documentType: 'USER_GROUP',
        },
        {
          id: randomUUID(),
          groupName: 'USTP CAMS Auditor',
          users: [MockData.getCamsUserReference()],
          documentType: 'USER_GROUP',
        },
      ];

      const findSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValue(mockGroups);

      const result = await repo.getUserGroupsByNames(context, groupNames);

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          condition: 'CONTAINS',
          leftOperand: { name: 'groupName' },
          rightOperand: groupNames,
        }),
      );
      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty('documentType');
      expect(result[0]).toEqual({
        id: mockGroups[0].id,
        groupName: 'USTP CAMS Trial Attorney',
        users: mockGroups[0].users,
      });
      expect(result[1]).toEqual({
        id: mockGroups[1].id,
        groupName: 'USTP CAMS Auditor',
        users: mockGroups[1].users,
      });
    });

    test('should return empty array when no groups match', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);

      const result = await repo.getUserGroupsByNames(context, ['NonExistent']);

      expect(result).toEqual([]);
    });

    test('should throw CamsError with context on failure', async () => {
      const mockError = new Error('Database error');
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(mockError);

      await expect(repo.getUserGroupsByNames(context, ['Test'])).rejects.toThrow(CamsError);
      await expect(repo.getUserGroupsByNames(context, ['Test'])).rejects.toMatchObject({
        message: 'Failed to retrieve user groups by names.',
        module: 'USER-GROUPS-MONGO-REPOSITORY',
      });
    });
  });
});
