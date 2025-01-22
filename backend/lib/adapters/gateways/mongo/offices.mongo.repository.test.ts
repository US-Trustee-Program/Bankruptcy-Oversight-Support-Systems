import { OfficesMongoRepository, OfficeStaff } from './offices.mongo.repository';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import QueryBuilder from '../../../query/query-builder';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { closeDeferred } from '../../../deferrable/defer-close';
import { createAuditRecord, SYSTEM_USER_REFERENCE } from '../../../../../common/src/cams/auditable';
import { getCamsError } from '../../../common-errors/error-utilities';
import { CamsSession } from '../../../../../common/src/cams/session';
import { DEFAULT_STAFF_TTL } from '../../../use-cases/offices/offices';
import { Staff } from '../../../../../common/src/cams/users';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { CamsError } from '../../../common-errors/cams-error';

describe('offices repo', () => {
  let context: ApplicationContext;
  let repo: OfficesMongoRepository;
  let session: CamsSession;
  const { and, equals, contains } = QueryBuilder;
  const officeCode = 'test_office_code';

  beforeAll(async () => {
    context = await createMockApplicationContext();
  });

  beforeEach(async () => {
    repo = OfficesMongoRepository.getInstance(context);
    session = await createMockApplicationContextSession();
  });

  afterEach(async () => {
    await closeDeferred(context);
    jest.restoreAllMocks();
    repo.release();
  });

  test('getOfficeAttorneys', async () => {
    const attorneyUsers = MockData.buildArray(MockData.getCamsUserReference, 3);
    const officeCode = 'office_code';
    const findSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'find')
      .mockResolvedValue(attorneyUsers);
    const query = QueryBuilder.build(
      and(
        equals<OfficeStaff['documentType']>('documentType', 'OFFICE_STAFF'),
        contains<OfficeStaff['roles']>('roles', [CamsRole.TrialAttorney]),
        equals<OfficeStaff['officeCode']>('officeCode', officeCode),
      ),
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
    jest
      .spyOn(MongoCollectionAdapter.prototype, 'findOne')
      .mockRejectedValue(new NotFoundError('test-module'));
    const replaceOneSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockResolvedValue({ id: 'inserted-id', modifiedCount: 1, upsertedCount: 0 });

    await repo.putOfficeStaff(officeCode, session.user);
    expect(replaceOneSpy).toHaveBeenCalledWith(
      expect.anything(),
      { ...staff, updatedOn: expect.anything() },
      true,
    );
  });

  test('should build correct query to delete staff', async () => {
    const deleteOneSpy = jest
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
      const findOneSpy = jest
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockResolvedValue(existing);
      const replaceOneSpy = jest
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
        ttl: expect.anything(),
      };

      await repo.putOrExtendOfficeStaff('test-office', staff, expires);

      expect(findOneSpy).toHaveBeenCalled();
      expect(replaceOneSpy).toHaveBeenCalledWith(expect.anything(), expectedStaff, true);
    },
  );

  test('should insert when no existing staff', async () => {
    jest
      .spyOn(MongoCollectionAdapter.prototype, 'findOne')
      .mockRejectedValue(new NotFoundError('test-module'));
    const replaceOneSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockResolvedValue({ id: 'inserted-id', modifiedCount: 0, upsertedCount: 1 });
    const expectedStaff: OfficeStaff = {
      documentType: 'OFFICE_STAFF',
      officeCode: 'test-office',
      ...staff,
      roles: [CamsRole.TrialAttorney],
      updatedBy: expect.anything(),
      updatedOn: expect.anything(),
      ttl: expect.anything(),
    };

    await repo.putOrExtendOfficeStaff(
      'test-office',
      staff,
      MockData.someDateAfterThisDate(new Date().toISOString()),
    );
    expect(replaceOneSpy).toHaveBeenCalledWith(expect.anything(), expectedStaff, true);
  });

  describe('error handling', () => {
    const module = 'OFFICES_MONGO_REPOSITORY';
    const error = new Error('some error');
    const camsError = getCamsError(error, module);

    test('getOfficeAttorneys error handling', async () => {
      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(error);

      await expect(() => repo.getOfficeAttorneys(officeCode)).rejects.toThrow(camsError);
    });

    test('putOfficeStaff error handling', async () => {
      jest
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockRejectedValue(new NotFoundError('test-module'));
      jest.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockRejectedValue(error);

      const expectedError = {
        ...camsError,
        message: `Failed to write user ${session.user.id} to ${officeCode}.`,
      };
      await expect(() => repo.putOfficeStaff(officeCode, session.user)).rejects.toThrow(
        expectedError,
      );
    });

    test('should throw CamsError', async () => {
      jest.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockRejectedValue(error);

      await expect(repo.findAndDeleteStaff(officeCode, session.user.id)).rejects.toThrow(
        expect.objectContaining({ module, message: 'Unknown Error' }),
      );
    });

    test('should throw CamsError when putOrExtendOfficeStaff encounters an error', async () => {
      jest
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockRejectedValue(new NotFoundError('test-module'));
      jest
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockRejectedValue(new Error('some error'));
      const expires = MockData.someDateAfterThisDate(new Date().toISOString(), 2);
      const expectedError = new CamsError(expect.anything(), {
        message: 'Unknown Error',
        camsStackInfo: {
          message: 'Failed to create or update office staff.',
          module: expect.anything(),
        },
      });
      await expect(repo.putOrExtendOfficeStaff('test-office', staff, expires)).rejects.toThrow(
        expectedError,
      );
    });

    test('should throw CamsError when findOne throws an error other than NotFound when putOrExtendOfficeStaff is called', async () => {
      jest
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockRejectedValue(new Error('some error'));
      const expires = MockData.someDateAfterThisDate(new Date().toISOString(), 2);

      const expectedError = new CamsError(expect.anything(), {
        message: 'Unknown Error',
        camsStackInfo: {
          message: 'Failed to create or update office staff.',
          module: expect.anything(),
        },
      });
      await expect(repo.putOrExtendOfficeStaff('test-office', staff, expires)).rejects.toThrow(
        expectedError,
      );
    });
  });
});
