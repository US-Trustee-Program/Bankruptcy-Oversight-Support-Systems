import { MockHumbleQuery } from '../../testing/mock.cosmos-client-humble';
import { OfficesCosmosDbRepository, OfficeStaff } from './offices.cosmosdb.repository';
import { ApplicationContext } from '../types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { CosmosDbRepository } from './cosmos/cosmos.repository';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { SYSTEM_USER_REFERENCE } from '../../../../../common/src/cams/auditable';
import { getCamsUserReference } from '../../../../../common/src/cams/session';

describe('offices cosmosDB repository tests', () => {
  let context: ApplicationContext;
  let repo: OfficesCosmosDbRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = new OfficesCosmosDbRepository(context);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should query data with office code, staff doc type, and trial attorney role', async () => {
    const officeCode = 'test-office';
    const attorneys = MockData.buildArray(MockData.getAttorneyUser, 5).map((user) =>
      getCamsUserReference(user),
    );
    const staffDocs: OfficeStaff[] = attorneys.map((user) => {
      return {
        id: user.id,
        documentType: 'OFFICE_STAFF',
        officeCode,
        ...user,
        updatedOn: '2024-10-01T00:00:00.000Z',
        updatedBy: SYSTEM_USER_REFERENCE,
        ttl: 100,
      };
    });
    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({ resources: staffDocs });
    const querySpy = jest.spyOn(CosmosDbRepository.prototype, 'query');

    const actual = await repo.getOfficeAttorneys(context, officeCode);
    expect(actual).toEqual(attorneys);
    expect(querySpy).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        query: expect.any(String),
        parameters: expect.arrayContaining([expect.objectContaining({ value: officeCode })]),
      }),
    );
    expect(querySpy.mock.calls[0][1]['query']).toContain('OFFICE_STAFF');
    expect(querySpy.mock.calls[0][1]['parameters']).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: CamsRole.TrialAttorney })]),
    );
  });
});
