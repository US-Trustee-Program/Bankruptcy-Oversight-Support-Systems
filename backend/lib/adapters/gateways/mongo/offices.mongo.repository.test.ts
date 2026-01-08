import { vi } from 'vitest';
import { OfficesMongoRepository, OfficeStaff } from './offices.mongo.repository';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import MockData from '@common/cams/test-utilities/mock-data';
import QueryBuilder, { using } from '../../../query/query-builder';
import { CamsRole } from '@common/cams/roles';
import { closeDeferred } from '../../../deferrable/defer-close';
import { createAuditRecord, SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { getCamsError } from '../../../common-errors/error-utilities';
import { CamsSession } from '@common/cams/session';
import { DEFAULT_STAFF_TTL } from '../../../use-cases/offices/offices';
import { Staff } from '@common/cams/users';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { OfficeUserRolesPredicate } from '@common/api/search';

describe('offices repo', () => {
  let context: ApplicationContext;
  let repo: OfficesMongoRepository;
  let session: CamsSession;
  const { and } = QueryBuilder;
  const officeCode = 'test_office_code';
  const doc = using<OfficeStaff>();

  beforeAll(async () => {
    context = await createMockApplicationContext();
  });

  beforeEach(async () => {
    repo = OfficesMongoRepository.getInstance(context);
    session = await createMockApplicationContextSession();
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.restoreAllMocks();
    repo.release();
  });

  test('getOfficeAttorneys', async () => {
    const attorneyUsers = MockData.buildArray(MockData.getCamsUserReference, 3);
    const officeCode = 'office_code';
    const findSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue(attorneyUsers);

    const query = and(
      doc('documentType').equals('OFFICE_STAFF'),
      doc('roles').contains([CamsRole.TrialAttorney]),
      doc('officeCode').equals(officeCode),
    );
    const attorneys = await repo.getOfficeAttorneys(officeCode);
    expect(findSpy).toHaveBeenCalledWith(query);
    expect(attorneys).toEqual(attorneyUsers);
  });

  test('putOfficeStaff', async () => {
    const staff = createAuditRecord<OfficeStaff>({
      id: session.user.id,
      documentType: 'OFFICE_STAFF',
      officeCode,
      ...session.user,
      ttl: DEFAULT_STAFF_TTL,
    });
    vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(
      new NotFoundError('test-module'),
    );
    const replaceOneSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockResolvedValue({ id: 'inserted-id', modifiedCount: 1, upsertedCount: 0 });

    await repo.putOfficeStaff(officeCode, session.user);
    expect(replaceOneSpy).toHaveBeenCalledWith(
      expect.anything(),
      {
        ...staff,
        updatedOn: expect.anything(),
        createdBy: expect.anything(),
        createdOn: expect.anything(),
      },
      true,
    );
  });

  test('putOfficeStaff uses existing.ttl if it is greater than provided ttl', async () => {
    const officeCode = 'test-office';
    const staff = { ...MockData.getCamsUserReference(), roles: [CamsRole.TrialAttorney] };
    const existing = {
      documentType: 'OFFICE_STAFF',
      officeCode,
      ...staff,
      roles: [CamsRole.CaseAssignmentManager],
      updatedBy: SYSTEM_USER_REFERENCE,
      updatedOn: '2025-01-01',
      ttl: 10000, // greater than provided ttl
    };
    vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(existing);
    const replaceOneSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockResolvedValue({ id: 'inserted-id', modifiedCount: 1, upsertedCount: 0 });
    await repo.putOfficeStaff(officeCode, staff, 5000);
    const calledStaff = replaceOneSpy.mock.calls[0][1];
    expect(calledStaff.ttl).toBe(10000);
  });

  test('putOfficeStaff uses provided ttl if it is greater than existing.ttl', async () => {
    const officeCode = 'test-office';
    const staff = { ...MockData.getCamsUserReference(), roles: [CamsRole.TrialAttorney] };
    const existing = {
      documentType: 'OFFICE_STAFF',
      officeCode,
      ...staff,
      roles: [CamsRole.CaseAssignmentManager],
      updatedBy: SYSTEM_USER_REFERENCE,
      updatedOn: '2025-01-01',
      ttl: 5000, // less than provided ttl
    };
    vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(existing);
    const replaceOneSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockResolvedValue({ id: 'inserted-id', modifiedCount: 1, upsertedCount: 0 });
    await repo.putOfficeStaff(officeCode, staff, 10000);
    const calledStaff = replaceOneSpy.mock.calls[0][1];
    expect(calledStaff.ttl).toBe(10000);
  });

  test('should build correct query to delete staff', async () => {
    const deleteOneSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'deleteOne')
      .mockResolvedValue(1);

    await repo.findAndDeleteStaff(officeCode, session.user.id);
    expect(deleteOneSpy).toHaveBeenCalled();
  });

  const staff: Staff = {
    ...MockData.getCamsUserReference(),
    roles: [CamsRole.TrialAttorney],
  };
  const staffRecords = [
    ['nonexisting', null],
    [
      'existing',
      {
        documentType: 'OFFICE_STAFF',
        officeCode: 'test-office',
        ...staff,
        roles: [CamsRole.CaseAssignmentManager],
        updatedBy: SYSTEM_USER_REFERENCE,
        updatedOn: '2025-01-01',
        ttl: DEFAULT_STAFF_TTL,
      } as OfficeStaff,
    ],
  ];
  test.each(staffRecords)(
    'should extend %s staff when calling putOrExtendOfficeStaff',
    async (_name: string, existing: OfficeStaff | null) => {
      const findOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockResolvedValue(existing);
      const replaceOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValue({ id: 'inserted-id', modifiedCount: 1, upsertedCount: 0 });

      const expires = MockData.someDateAfterThisDate(new Date().toISOString(), 2);

      const expectedRoles = existing
        ? [CamsRole.TrialAttorney, CamsRole.CaseAssignmentManager]
        : [CamsRole.TrialAttorney];
      const expectedStaff: OfficeStaff = {
        documentType: 'OFFICE_STAFF',
        officeCode: 'test-office',
        ...staff,
        roles: expect.arrayContaining(expectedRoles),
        updatedBy: expect.anything(),
        updatedOn: expect.anything(),
        createdBy: expect.anything(),
        createdOn: expect.anything(),
        ttl: expect.anything(),
      };

      await repo.putOrExtendOfficeStaff('test-office', staff, expires);

      expect(findOneSpy).toHaveBeenCalled();
      expect(replaceOneSpy).toHaveBeenCalledWith(expect.anything(), expectedStaff, true);
    },
  );

  test('should insert when no existing staff', async () => {
    vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(
      new NotFoundError('test-module'),
    );
    const replaceOneSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockResolvedValue({ id: 'inserted-id', modifiedCount: 0, upsertedCount: 1 });
    const expectedStaff: OfficeStaff = {
      documentType: 'OFFICE_STAFF',
      officeCode: 'test-office',
      ...staff,
      roles: [CamsRole.TrialAttorney],
      updatedBy: expect.anything(),
      updatedOn: expect.anything(),
      createdBy: expect.anything(),
      createdOn: expect.anything(),
      ttl: expect.anything(),
    };

    await repo.putOrExtendOfficeStaff(
      'test-office',
      staff,
      MockData.someDateAfterThisDate(new Date().toISOString()),
    );
    expect(replaceOneSpy).toHaveBeenCalledWith(expect.anything(), expectedStaff, true);
  });

  test('putOrExtendOfficeStaff uses existing.ttl if it is greater than newTtl', async () => {
    const officeCode = 'test-office';
    const staff = { ...MockData.getCamsUserReference(), roles: [CamsRole.TrialAttorney] };
    const existing = {
      documentType: 'OFFICE_STAFF',
      officeCode,
      ...staff,
      roles: [CamsRole.CaseAssignmentManager],
      updatedBy: SYSTEM_USER_REFERENCE,
      updatedOn: '2025-01-01',
      ttl: 10000, // greater than newTtl
    };
    vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(existing);
    const replaceOneSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockResolvedValue({ id: 'inserted-id', modifiedCount: 1, upsertedCount: 0 });
    // newTtl is less than existing.ttl
    const expires = new Date(Date.now() + 5000 * 1000).toISOString();
    await repo.putOrExtendOfficeStaff(officeCode, staff, expires);
    const calledStaff = replaceOneSpy.mock.calls[0][1];
    expect(calledStaff.ttl).toBe(10000);
  });

  test('putOrExtendOfficeStaff uses newTtl if it is greater than existing.ttl', async () => {
    const officeCode = 'test-office';
    const staff = { ...MockData.getCamsUserReference(), roles: [CamsRole.TrialAttorney] };
    const existing = {
      documentType: 'OFFICE_STAFF',
      officeCode,
      ...staff,
      roles: [CamsRole.CaseAssignmentManager],
      updatedBy: SYSTEM_USER_REFERENCE,
      updatedOn: '2025-01-01',
      ttl: 5000, // less than newTtl
    };
    vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(existing);
    const replaceOneSpy = vi
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockResolvedValue({ id: 'inserted-id', modifiedCount: 1, upsertedCount: 0 });
    // newTtl is greater than existing.ttl
    const expires = new Date(Date.now() + 10000 * 1000).toISOString();
    await repo.putOrExtendOfficeStaff(officeCode, staff, expires);
    const calledStaff = replaceOneSpy.mock.calls[0][1];
    expect(calledStaff.ttl).toBeGreaterThan(9000); // allow for some clock drift
  });

  test('should search', async () => {
    const findSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);
    const predicate: OfficeUserRolesPredicate = {
      userId: 'test-user',
      officeCode: 'test-office',
      role: CamsRole.TrialAttorney,
    };
    await repo.search(predicate);
    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.arrayContaining([
          expect.objectContaining({ leftOperand: { name: 'id' }, rightOperand: 'test-user' }),
          expect.objectContaining({
            leftOperand: { name: 'officeCode' },
            rightOperand: 'test-office',
          }),
          expect.objectContaining({
            leftOperand: { name: 'roles' },
            rightOperand: [CamsRole.TrialAttorney],
          }),
        ]),
      }),
    );
  });

  test('search with no predicate calls find with null and returns result', async () => {
    const expected = [{ id: 'a' }, { id: 'b' }];
    const findSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(expected);
    const actual = await repo.search();
    expect(findSpy).toHaveBeenCalledWith(null);
    expect(actual).toBe(expected);
  });

  describe('error handling', () => {
    const module = 'OFFICES-MONGO-REPOSITORY';
    const error = new Error('some error');
    const camsError = getCamsError(error, module);

    test('getOfficeAttorneys error handling', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(error);

      await expect(() => repo.getOfficeAttorneys(officeCode)).rejects.toThrow(camsError);
    });

    test('putOfficeStaff error handling', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(
        new NotFoundError('test-module'),
      );
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockRejectedValue(error);

      const expectedError = {
        ...camsError,
        message: `Failed to write user ${session.user.id} to ${officeCode}.`,
      };
      await expect(() => repo.putOfficeStaff(officeCode, session.user)).rejects.toThrow(
        expect.objectContaining(expectedError),
      );
    });

    test('should throw CamsError', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockRejectedValue(error);

      await expect(repo.findAndDeleteStaff(officeCode, session.user.id)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unknown Error',
          status: 500,
          module: 'OFFICES-MONGO-REPOSITORY',
          originalError: expect.stringContaining('Error: some error'),
        }),
      );
    });

    test('should throw CamsError when putOrExtendOfficeStaff encounters an error', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(
        new NotFoundError('test-module'),
      );
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockRejectedValue(
        new Error('some error'),
      );
      const expires = MockData.someDateAfterThisDate(new Date().toISOString(), 2);
      await expect(repo.putOrExtendOfficeStaff('test-office', staff, expires)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unknown Error',
          status: 500,
          module: 'OFFICES-MONGO-REPOSITORY',
          originalError: expect.stringContaining('Error: some error'),
        }),
      );
    });

    test('should throw CamsError when findOne throws an error other than NotFound when putOrExtendOfficeStaff is called', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(
        new Error('some error'),
      );
      const expires = MockData.someDateAfterThisDate(new Date().toISOString(), 2);

      await expect(repo.putOrExtendOfficeStaff('test-office', staff, expires)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unknown Error',
          status: 500,
          module: 'OFFICES-MONGO-REPOSITORY',
          originalError: expect.stringContaining('Error: some error'),
        }),
      );
    });

    test('should throw CamsError when find throws an error other than NotFound', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(new Error('some error'));
      const predicate: OfficeUserRolesPredicate = {
        userId: 'test-user',
        officeCode: 'test-office',
        role: CamsRole.TrialAttorney,
      };

      await expect(repo.search(predicate)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unknown Error',
          status: 500,
          module: 'OFFICES-MONGO-REPOSITORY',
          originalError: expect.stringContaining('Error: some error'),
        }),
      );
    });

    test('should return empty array when find throws a NotFound error', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(
        new NotFoundError('not found'),
      );
      const predicate: OfficeUserRolesPredicate = {
        userId: 'test-user',
        officeCode: 'test-office',
        role: CamsRole.TrialAttorney,
      };

      const actual = await repo.search(predicate);
      expect(actual).toEqual([]);
    });
  });

  describe('branch and singleton logic', () => {
    test('singleton getInstance and dropInstance logic', async () => {
      // Ensure clean state using public API
      while (OfficesMongoRepository['referenceCount'] > 0) {
        await OfficesMongoRepository.dropInstance();
      }
      const context1 = await createMockApplicationContext();
      const repo1 = OfficesMongoRepository.getInstance(context1);
      expect(repo1).toBeDefined();
      expect(OfficesMongoRepository['referenceCount']).toBe(1);
      const context2 = await createMockApplicationContext();
      const repo2 = OfficesMongoRepository.getInstance(context2);
      expect(repo2).toBe(repo1); // Should be the same instance
      expect(OfficesMongoRepository['referenceCount']).toBe(2);
      // Drop once, should not close
      const closeSpy = vi.spyOn(repo1['client'], 'close').mockResolvedValue();
      OfficesMongoRepository.dropInstance();
      expect(OfficesMongoRepository['referenceCount']).toBe(1);
      expect(closeSpy).not.toHaveBeenCalled();
      // Drop again, should close and null instance
      OfficesMongoRepository.dropInstance();
      expect(OfficesMongoRepository['referenceCount']).toBe(0);
      // Wait for close to resolve
      await Promise.resolve();
      expect(closeSpy).toHaveBeenCalled();
      expect(OfficesMongoRepository['instance']).toBeNull();
    });

    test('release calls dropInstance', async () => {
      const dropSpy = vi.spyOn(OfficesMongoRepository, 'dropInstance');
      repo.release();
      expect(dropSpy).toHaveBeenCalled();
      dropSpy.mockRestore();
    });

    test('getOfficeAttorneys returns empty array if no staff', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);
      const actual = await repo.getOfficeAttorneys('some-office');
      expect(actual).toEqual([]);
    });

    test('search returns empty array if no results', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);
      const predicate = { userId: 'u', officeCode: 'o', role: CamsRole.TrialAttorney };
      const actual = await repo.search(predicate);
      expect(actual).toEqual([]);
    });

    test('findAndDeleteStaff throws if no staff found', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockRejectedValue(
        new NotFoundError('OFFICES-MONGO-REPOSITORY'),
      );
      await expect(repo.findAndDeleteStaff('office', 'user')).rejects.toThrow(NotFoundError);
    });

    test('putOrExtendOfficeStaff merges roles and updates TTL', async () => {
      const staff = { ...MockData.getCamsUserReference(), roles: [CamsRole.TrialAttorney] };
      const existing = {
        documentType: 'OFFICE_STAFF',
        officeCode: 'test-office',
        ...staff,
        roles: [CamsRole.CaseAssignmentManager],
        updatedBy: SYSTEM_USER_REFERENCE,
        updatedOn: '2025-01-01',
        ttl: DEFAULT_STAFF_TTL,
      };
      const findOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockResolvedValue(existing);
      const replaceOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValue({ id: 'inserted-id', modifiedCount: 1, upsertedCount: 0 });
      const expires = MockData.someDateAfterThisDate(new Date().toISOString(), 2);
      await repo.putOrExtendOfficeStaff('test-office', staff, expires);
      expect(findOneSpy).toHaveBeenCalled();
      expect(replaceOneSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          roles: expect.arrayContaining([CamsRole.TrialAttorney, CamsRole.CaseAssignmentManager]),
          ttl: expect.anything(),
        }),
        true,
      );
    });

    test('getOfficeAttorneys throws error from find', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(new Error('fail'));
      await expect(repo.getOfficeAttorneys('some-office')).rejects.toThrow('Unknown Error');
    });

    test('search throws non-NotFoundError from find', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(new Error('fail'));
      await expect(repo.search({ userId: 'u' })).rejects.toThrow('Unknown Error');
    });
  });
});
