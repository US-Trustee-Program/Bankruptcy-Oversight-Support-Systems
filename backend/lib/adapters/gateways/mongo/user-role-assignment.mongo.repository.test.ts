import { vi } from 'vitest';
import { ApplicationContext } from '../../types/basic';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { closeDeferred } from '../../../deferrable/defer-close';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { UserRoleAssignmentMongoRepository } from './user-role-assignment.mongo.repository';
import { UserRoleAssignment } from '@common/cams/user-access';
import { CamsRole } from '@common/cams/roles';
import QueryBuilder from '../../../query/query-builder';

const { and, using } = QueryBuilder;

describe('UserRoleAssignmentMongoRepository', () => {
  let context: ApplicationContext;
  let repo: UserRoleAssignmentMongoRepository;

  const assignment: UserRoleAssignment = {
    documentType: 'USER_ROLE_ASSIGNMENT',
    id: 'assignment-1',
    userId: 'user-1',
    userName: 'Jane Doe',
    email: 'jane.doe@example.com',
    role: CamsRole.TrialAttorney,
    regionId: '02',
    officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
    assignedBy: 'super-1',
    assignedByName: 'Super User',
    assignedAt: '2026-11-03T00:00:00.000Z',
    expiresAt: null,
    active: true,
    activeKey: 'TrialAttorney|02|USTP_CAMS_Region_2_Office_Manhattan',
  };

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    repo = UserRoleAssignmentMongoRepository.getInstance(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    repo.release();
  });

  describe('create', () => {
    test('should insert the assignment with its own id and return it', async () => {
      const insertOne = vi
        .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
        .mockResolvedValue(assignment.id);

      const result = await repo.create(assignment);

      expect(result).toEqual(assignment);
      expect(insertOne).toHaveBeenCalledWith(assignment, { useProvidedId: true });
    });

    test('should return null, not throw, when the user already has that active permission', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(
        new Error('Failed to insert item. E11000 duplicate key error collection'),
      );

      await expect(repo.create(assignment)).resolves.toBeNull();
    });

    test('should throw a CamsError when the insert fails for another reason', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(
        new Error('connection error'),
      );

      await expect(repo.create(assignment)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unable to create role assignment.',
          status: 500,
          module: 'USER-ROLE-ASSIGNMENT-MONGO-REPOSITORY',
        }),
      );
    });
  });

  describe('findActiveByUserAndRole', () => {
    test("should query the user's active assignments for that role and return them", async () => {
      const find = vi
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValue([assignment]);

      const result = await repo.findActiveByUserAndRole('user-1', CamsRole.TrialAttorney);

      const doc = using<UserRoleAssignment>();
      expect(result).toEqual([assignment]);
      expect(find).toHaveBeenCalledWith(
        and(
          doc('documentType').equals('USER_ROLE_ASSIGNMENT'),
          doc('userId').equals('user-1'),
          doc('role').equals(CamsRole.TrialAttorney),
          doc('active').equals(true),
        ),
      );
    });

    test('should throw a CamsError when the query fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(
        new Error('connection error'),
      );

      await expect(repo.findActiveByUserAndRole('user-1', CamsRole.TrialAttorney)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unable to retrieve role assignments.',
          status: 500,
          module: 'USER-ROLE-ASSIGNMENT-MONGO-REPOSITORY',
        }),
      );
    });
  });

  describe('findActiveByUserIds', () => {
    test('should query active assignments for the given users and return them', async () => {
      const find = vi
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValue([assignment]);

      const result = await repo.findActiveByUserIds(['user-1', 'user-2']);

      const doc = using<UserRoleAssignment>();
      expect(result).toEqual([assignment]);
      expect(find).toHaveBeenCalledWith(
        and(
          doc('documentType').equals('USER_ROLE_ASSIGNMENT'),
          doc('active').equals(true),
          doc('userId').contains(['user-1', 'user-2']),
        ),
      );
    });

    test('should return no assignments without querying when given no users', async () => {
      const find = vi.spyOn(MongoCollectionAdapter.prototype, 'find');

      const result = await repo.findActiveByUserIds([]);

      expect(result).toEqual([]);
      expect(find).not.toHaveBeenCalled();
    });

    test('should throw a CamsError when the query fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(
        new Error('connection error'),
      );

      await expect(repo.findActiveByUserIds(['user-1'])).rejects.toThrow(
        expect.objectContaining({
          message: 'Unable to retrieve role assignments.',
          status: 500,
          module: 'USER-ROLE-ASSIGNMENT-MONGO-REPOSITORY',
        }),
      );
    });
  });
});
