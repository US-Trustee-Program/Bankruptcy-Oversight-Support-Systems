import { vi } from 'vitest';
import { ApplicationContext } from '../../types/basic';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { closeDeferred } from '../../../deferrable/defer-close';
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
    reason: 'New hire',
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
});
