import { vi } from 'vitest';
import { ApplicationContext } from '../../types/basic';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { closeDeferred } from '../../../deferrable/defer-close';
import { using } from '../../../query/query-builder';
import { CamsPaginationResponse } from '../../../use-cases/gateways.types';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { RoleAssignmentAuditMongoRepository } from './role-assignment-audit.mongo.repository';
import { RoleAssignmentAuditEntry } from '@common/cams/user-access';
import { CamsRole } from '@common/cams/roles';

describe('RoleAssignmentAuditMongoRepository', () => {
  let context: ApplicationContext;
  let repo: RoleAssignmentAuditMongoRepository;

  const entry: RoleAssignmentAuditEntry = {
    documentType: 'ROLE_ASSIGNMENT_AUDIT',
    id: 'audit-1',
    assignmentId: 'assignment-1',
    action: 'CREATED',
    userId: 'user-1',
    userName: 'Jane Doe',
    role: CamsRole.TrialAttorney,
    regionId: '02',
    officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
    performedBy: 'super-1',
    performedByName: 'Super User',
    performedAt: '2026-11-03T00:00:00.000Z',
    previousState: null,
    newState: {
      role: CamsRole.TrialAttorney,
      regionId: '02',
      officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
      active: true,
    },
    replacedByAssignmentId: null,
  };

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    repo = RoleAssignmentAuditMongoRepository.getInstance(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    repo.release();
  });

  test('should insert the audit entry with its own id', async () => {
    const insertOne = vi
      .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
      .mockResolvedValue(entry.id);

    await repo.create(entry);

    expect(insertOne).toHaveBeenCalledWith(entry, { useProvidedId: true });
  });

  test('should throw a CamsError when the insert fails', async () => {
    vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(
      new Error('connection error'),
    );

    await expect(repo.create(entry)).rejects.toThrow(
      expect.objectContaining({
        message: 'Unable to create role assignment audit record.',
        status: 500,
        module: 'ROLE-ASSIGNMENT-AUDIT-MONGO-REPOSITORY',
      }),
    );
  });

  describe('search', () => {
    const expectedPage: CamsPaginationResponse<RoleAssignmentAuditEntry> = {
      metadata: { total: 1 },
      data: [entry],
    };

    test('should page every record, newest first, when userIds is absent', async () => {
      const paginate = vi
        .spyOn(MongoCollectionAdapter.prototype, 'paginate')
        .mockResolvedValue(expectedPage);

      const result = await repo.search({ offset: 0, limit: 20 });

      const doc = using<RoleAssignmentAuditEntry>();
      const expectedQuery = {
        stages: [
          expect.objectContaining({
            stage: 'MATCH',
            conjunction: 'AND',
            values: [doc('documentType').equals('ROLE_ASSIGNMENT_AUDIT')],
          }),
          expect.objectContaining({
            stage: 'SORT',
            fields: [
              { field: { name: 'performedAt' }, direction: 'DESCENDING' },
              { field: { name: 'action' }, direction: 'DESCENDING' },
              { field: { name: 'id' }, direction: 'DESCENDING' },
            ],
          }),
          expect.objectContaining({
            stage: 'PAGINATE',
            skip: 0,
            limit: 20,
          }),
        ],
      };
      expect(paginate).toHaveBeenCalledWith(expect.objectContaining(expectedQuery));
      expect(result).toEqual(expectedPage);
    });

    test('should filter by userIds when present', async () => {
      const paginate = vi
        .spyOn(MongoCollectionAdapter.prototype, 'paginate')
        .mockResolvedValue(expectedPage);

      await repo.search({ offset: 0, limit: 20, userIds: ['user-1', 'user-2'] });

      const doc = using<RoleAssignmentAuditEntry>();
      expect(paginate).toHaveBeenCalledWith(
        expect.objectContaining({
          stages: [
            expect.objectContaining({
              stage: 'MATCH',
              conjunction: 'AND',
              values: [
                doc('documentType').equals('ROLE_ASSIGNMENT_AUDIT'),
                doc('userId').contains(['user-1', 'user-2']),
              ],
            }),
            expect.anything(),
            expect.anything(),
          ],
        }),
      );
    });

    test('should return an empty page without querying when userIds is empty', async () => {
      const paginate = vi
        .spyOn(MongoCollectionAdapter.prototype, 'paginate')
        .mockRejectedValue(new Error('should not be called'));

      const result = await repo.search({ offset: 0, limit: 20, userIds: [] });

      expect(result).toEqual({ metadata: { total: 0 }, data: [] });
      expect(paginate).not.toHaveBeenCalled();
    });

    test('should throw a CamsError when the query fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'paginate').mockRejectedValue(
        new Error('connection error'),
      );

      await expect(repo.search({ offset: 0, limit: 20 })).rejects.toThrow(
        expect.objectContaining({
          message: 'Unable to search role assignment audit records.',
          status: 500,
          module: 'ROLE-ASSIGNMENT-AUDIT-MONGO-REPOSITORY',
        }),
      );
    });
  });

  describe('singleton and release logic', () => {
    test('singleton getInstance and dropInstance logic', async () => {
      while (RoleAssignmentAuditMongoRepository['referenceCount'] > 0) {
        RoleAssignmentAuditMongoRepository.dropInstance();
      }

      const context1 = await createMockApplicationContext();
      const repo1 = RoleAssignmentAuditMongoRepository.getInstance(context1);
      expect(repo1).toBeDefined();
      expect(RoleAssignmentAuditMongoRepository['referenceCount']).toBe(1);

      const context2 = await createMockApplicationContext();
      const repo2 = RoleAssignmentAuditMongoRepository.getInstance(context2);
      expect(repo2).toBe(repo1);
      expect(RoleAssignmentAuditMongoRepository['referenceCount']).toBe(2);

      const closeSpy = vi.spyOn(repo1['client'], 'close').mockResolvedValue();
      RoleAssignmentAuditMongoRepository.dropInstance();
      expect(RoleAssignmentAuditMongoRepository['referenceCount']).toBe(1);
      expect(closeSpy).not.toHaveBeenCalled();

      RoleAssignmentAuditMongoRepository.dropInstance();
      expect(RoleAssignmentAuditMongoRepository['referenceCount']).toBe(0);
      await Promise.resolve();
      expect(closeSpy).toHaveBeenCalled();
      expect(RoleAssignmentAuditMongoRepository['instance']).toBeNull();
    });

    test('release calls dropInstance', () => {
      const dropSpy = vi.spyOn(RoleAssignmentAuditMongoRepository, 'dropInstance');
      repo.release();
      expect(dropSpy).toHaveBeenCalled();
      dropSpy.mockRestore();
    });
  });
});
