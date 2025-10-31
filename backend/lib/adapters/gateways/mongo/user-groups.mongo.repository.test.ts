import { UserGroupsMongoRepository } from './user-groups.mongo.repository';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { closeDeferred } from '../../../deferrable/defer-close';
import { UserGroupGatewayDocument } from '../../../use-cases/gateways.types';
import { CamsError } from '../../../common-errors/cams-error';

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
    jest.restoreAllMocks();
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
      const closeSpy = jest.spyOn(instance1['client'], 'close').mockResolvedValue();

      UserGroupsMongoRepository.dropInstance();

      expect(closeSpy).not.toHaveBeenCalled();

      // Clean up remaining reference
      UserGroupsMongoRepository.dropInstance();
    });
  });

  describe('release', () => {
    test('should call dropInstance', () => {
      const dropInstanceSpy = jest.spyOn(UserGroupsMongoRepository, 'dropInstance');
      repo.release();
      expect(dropInstanceSpy).toHaveBeenCalled();
    });
  });

  describe('getOversightStaff', () => {
    test('should retrieve attorneys and auditors from user-groups collection', async () => {
      const attorneys = MockData.buildArray(MockData.getCamsUserReference, 3);
      const auditors = MockData.buildArray(MockData.getCamsUserReference, 2);

      const mockGroups: UserGroupGatewayDocument[] = [
        {
          groupName: 'USTP CAMS Trial Attorney',
          users: attorneys,
        },
        {
          groupName: 'USTP CAMS Auditor',
          users: auditors,
        },
      ];

      const findSpy = jest
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValue(mockGroups);

      const result = await repo.getOversightStaff(context);

      expect(findSpy).toHaveBeenCalledWith(expect.anything());
      expect(result).toEqual({
        attorneys,
        auditors,
      });
    });

    test('should return empty arrays when no groups found', async () => {
      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);

      const result = await repo.getOversightStaff(context);

      expect(result).toEqual({
        attorneys: [],
        auditors: [],
      });
    });

    test('should handle attorneys group without users array', async () => {
      const auditors = MockData.buildArray(MockData.getCamsUserReference, 2);

      const mockGroups: UserGroupGatewayDocument[] = [
        {
          groupName: 'USTP CAMS Trial Attorney',
          users: undefined,
        },
        {
          groupName: 'USTP CAMS Auditor',
          users: auditors,
        },
      ];

      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(mockGroups);

      const result = await repo.getOversightStaff(context);

      expect(result).toEqual({
        attorneys: [],
        auditors,
      });
    });

    test('should handle auditors group without users array', async () => {
      const attorneys = MockData.buildArray(MockData.getCamsUserReference, 3);

      const mockGroups: UserGroupGatewayDocument[] = [
        {
          groupName: 'USTP CAMS Trial Attorney',
          users: attorneys,
        },
        {
          groupName: 'USTP CAMS Auditor',
          users: undefined,
        },
      ];

      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(mockGroups);

      const result = await repo.getOversightStaff(context);

      expect(result).toEqual({
        attorneys,
        auditors: [],
      });
    });

    test('should only return attorneys when only attorney group exists', async () => {
      const attorneys = MockData.buildArray(MockData.getCamsUserReference, 3);

      const mockGroups: UserGroupGatewayDocument[] = [
        {
          groupName: 'USTP CAMS Trial Attorney',
          users: attorneys,
        },
      ];

      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(mockGroups);

      const result = await repo.getOversightStaff(context);

      expect(result).toEqual({
        attorneys,
        auditors: [],
      });
    });

    test('should only return auditors when only auditor group exists', async () => {
      const auditors = MockData.buildArray(MockData.getCamsUserReference, 2);

      const mockGroups: UserGroupGatewayDocument[] = [
        {
          groupName: 'USTP CAMS Auditor',
          users: auditors,
        },
      ];

      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(mockGroups);

      const result = await repo.getOversightStaff(context);

      expect(result).toEqual({
        attorneys: [],
        auditors,
      });
    });

    test('should ignore unrecognized group names', async () => {
      const attorneys = MockData.buildArray(MockData.getCamsUserReference, 3);

      const mockGroups: UserGroupGatewayDocument[] = [
        {
          groupName: 'USTP CAMS Trial Attorney',
          users: attorneys,
        },
        {
          groupName: 'Some Other Group',
          users: MockData.buildArray(MockData.getCamsUserReference, 5),
        },
      ];

      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(mockGroups);

      const result = await repo.getOversightStaff(context);

      expect(result).toEqual({
        attorneys,
        auditors: [],
      });
    });

    test('should log info message with counts', async () => {
      const attorneys = MockData.buildArray(MockData.getCamsUserReference, 3);
      const auditors = MockData.buildArray(MockData.getCamsUserReference, 2);

      const mockGroups: UserGroupGatewayDocument[] = [
        {
          groupName: 'USTP CAMS Trial Attorney',
          users: attorneys,
        },
        {
          groupName: 'USTP CAMS Auditor',
          users: auditors,
        },
      ];

      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(mockGroups);
      const loggerSpy = jest.spyOn(context.logger, 'info');

      await repo.getOversightStaff(context);

      expect(loggerSpy).toHaveBeenCalledWith(
        'USER-GROUPS-MONGO-REPOSITORY',
        'Retrieved 3 attorneys and 2 auditors',
      );
    });

    test('should throw CamsError when database operation fails', async () => {
      const dbError = new Error('Database connection failed');
      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(dbError);

      await expect(repo.getOversightStaff(context)).rejects.toThrow(CamsError);
      await expect(repo.getOversightStaff(context)).rejects.toMatchObject({
        message: 'Failed to retrieve oversight staff from user-groups collection.',
        module: 'USER-GROUPS-MONGO-REPOSITORY',
      });
    });
  });

  describe('upsertUserGroupsBatch', () => {
    test('should upsert user groups successfully', async () => {
      const userGroups: UserGroupGatewayDocument[] = [
        {
          groupName: 'USTP CAMS Trial Attorney',
          users: MockData.buildArray(MockData.getCamsUserReference, 3),
        },
        {
          groupName: 'USTP CAMS Auditor',
          users: MockData.buildArray(MockData.getCamsUserReference, 2),
        },
      ];

      const bulkReplaceSpy = jest
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
            replacement: userGroups[0],
          },
          {
            filter: expect.objectContaining({
              condition: 'EQUALS',
              rightOperand: 'USTP CAMS Auditor',
            }),
            replacement: userGroups[1],
          },
        ]),
      );
    });

    test('should log info message with upsert counts', async () => {
      const userGroups: UserGroupGatewayDocument[] = [
        {
          groupName: 'USTP CAMS Trial Attorney',
          users: MockData.buildArray(MockData.getCamsUserReference, 3),
        },
      ];

      jest.spyOn(MongoCollectionAdapter.prototype, 'bulkReplace').mockResolvedValue({
        id: 'bulk-result-id',
        insertedCount: 0,
        matchedCount: 0,
        modifiedCount: 0,
        deletedCount: 0,
        upsertedCount: 1,
        upsertedIds: {},
        insertedIds: {},
      });

      const loggerSpy = jest.spyOn(context.logger, 'info');

      await repo.upsertUserGroupsBatch(context, userGroups);

      expect(loggerSpy).toHaveBeenCalledWith(
        'USER-GROUPS-MONGO-REPOSITORY',
        'Bulk upsert completed: 1 inserted, 0 updated',
      );
    });

    test('should return early when user groups array is empty', async () => {
      const bulkReplaceSpy = jest.spyOn(MongoCollectionAdapter.prototype, 'bulkReplace');
      const loggerSpy = jest.spyOn(context.logger, 'info');

      await repo.upsertUserGroupsBatch(context, []);

      expect(bulkReplaceSpy).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        'USER-GROUPS-MONGO-REPOSITORY',
        'No user groups to upsert',
      );
    });

    test('should throw CamsError when bulkReplace operation fails', async () => {
      const userGroups: UserGroupGatewayDocument[] = [
        {
          groupName: 'USTP CAMS Trial Attorney',
          users: MockData.buildArray(MockData.getCamsUserReference, 3),
        },
      ];

      const dbError = new Error('Bulk replace operation failed');
      jest.spyOn(MongoCollectionAdapter.prototype, 'bulkReplace').mockRejectedValue(dbError);

      await expect(repo.upsertUserGroupsBatch(context, userGroups)).rejects.toThrow(CamsError);
      await expect(repo.upsertUserGroupsBatch(context, userGroups)).rejects.toMatchObject({
        message: 'Failed to upsert user groups batch.',
        module: 'USER-GROUPS-MONGO-REPOSITORY',
      });
    });

    test('should handle multiple groups with correct filter and replacement', async () => {
      const userGroups: UserGroupGatewayDocument[] = [
        {
          groupName: 'Group A',
          users: [MockData.getCamsUserReference()],
        },
        {
          groupName: 'Group B',
          users: [MockData.getCamsUserReference()],
        },
        {
          groupName: 'Group C',
          users: [MockData.getCamsUserReference()],
        },
      ];

      const bulkReplaceSpy = jest
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
            replacement: userGroups[0],
          },
          {
            filter: expect.objectContaining({
              condition: 'EQUALS',
              rightOperand: 'Group B',
            }),
            replacement: userGroups[1],
          },
          {
            filter: expect.objectContaining({
              condition: 'EQUALS',
              rightOperand: 'Group C',
            }),
            replacement: userGroups[2],
          },
        ]),
      );
    });
  });
});
