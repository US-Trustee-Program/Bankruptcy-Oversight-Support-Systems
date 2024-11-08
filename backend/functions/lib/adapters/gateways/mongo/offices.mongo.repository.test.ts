import { OfficesMongoRepository, OfficeStaff } from './offices.mongo.repository';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import MockData from '../../../../../../common/src/cams/test-utilities/mock-data';
import QueryBuilder from '../../../query/query-builder';
import { CamsRole } from '../../../../../../common/src/cams/roles';
import { closeDeferred } from '../../../defer-close';
import { createAuditRecord } from '../../../../../../common/src/cams/auditable';
import { getCamsError } from '../../../common-errors/error-utilities';

describe('offices repo', () => {
  let context: ApplicationContext;
  let repo: OfficesMongoRepository;
  const { and, equals, contains } = QueryBuilder;

  beforeAll(async () => {
    context = await createMockApplicationContext();
    repo = new OfficesMongoRepository(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    jest.restoreAllMocks();
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
    const session = await createMockApplicationContextSession();
    const officeCode = 'test_office_code';

    const ttl = 4500;
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

  describe('error handling', () => {
    const error = new Error('some error');
    const camsError = getCamsError(error, 'COSMOS_DB_REPOSITORY_CONSOLIDATION_ORDERS');

    test('getOfficeAttorneys error handling', async () => {
      const officeCode = 'office_code';
      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(error);

      expect(async () => await repo.getOfficeAttorneys(officeCode)).rejects.toThrow(camsError);
    });

    test('putOfficeStaff error handling', async () => {
      const session = await createMockApplicationContextSession();
      const officeCode = 'test_office_code';

      jest.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(error);

      expect(async () => await repo.putOfficeStaff(officeCode, session.user)).rejects.toThrow(
        camsError,
      );
    });
  });
});
