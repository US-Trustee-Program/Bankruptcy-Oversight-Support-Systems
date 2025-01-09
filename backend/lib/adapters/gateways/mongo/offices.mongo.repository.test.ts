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
import { createAuditRecord } from '../../../../../common/src/cams/auditable';
import { getCamsError } from '../../../common-errors/error-utilities';
import { CamsSession } from '../../../../../common/src/cams/session';

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
    const ttl = 86400;
    const staff = createAuditRecord<OfficeStaff>({
      id: session.user.id,
      documentType: 'OFFICE_STAFF',
      officeCode,
      ...session.user,
      ttl,
    });
    const replaceOneSpy = jest
      .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
      .mockResolvedValue('inserted-id');

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

  describe('error handling', () => {
    const error = new Error('some error');
    const camsError = getCamsError(error, 'COSMOS_DB_REPOSITORY_CONSOLIDATION_ORDERS');

    test('getOfficeAttorneys error handling', async () => {
      const officeCode = 'office_code';
      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(error);

      await expect(() => repo.getOfficeAttorneys(officeCode)).rejects.toThrow(camsError);
    });

    test('putOfficeStaff error handling', async () => {
      const session = await createMockApplicationContextSession();
      const officeCode = 'test_office_code';

      jest.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockRejectedValue(error);

      const expectedError = {
        ...camsError,
        message: `Failed to write user ${session.user.id} to ${officeCode}.`,
      };
      await expect(() => repo.putOfficeStaff(officeCode, session.user)).rejects.toThrow(
        expectedError,
      );
    });

    // TODO: test error cases for findAndDeleteStaff
  });
});
