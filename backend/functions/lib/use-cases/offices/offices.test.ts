import { OfficesUseCase } from './offices';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import * as factory from '../../factory';
import OktaUserGroupGateway from '../../adapters/gateways/okta/okta-user-group-gateway';
import { UserGroupGatewayConfig } from '../../adapters/types/authorization';
import { CamsUserGroup, CamsUserReference } from '../../../../../common/src/cams/users';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { USTP_OFFICES_ARRAY } from '../../../../../common/src/cams/offices';
import { TRIAL_ATTORNEYS } from '../../../../../common/src/cams/test-utilities/attorneys.mock';
import AttorneysList from '../attorneys';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { MockOfficesRepository } from '../../testing/mock-gateways/mock.offices.repository';

describe('offices use case tests', () => {
  let applicationContext: ApplicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return offices', async () => {
    const useCase = new OfficesUseCase();

    jest.spyOn(factory, 'getOfficesGateway').mockImplementation(() => {
      return {
        getOfficeName: jest.fn(),
        getOffices: jest.fn().mockResolvedValue(USTP_OFFICES_ARRAY),
      };
    });

    const offices = await useCase.getOffices(applicationContext);

    expect(offices).toEqual(USTP_OFFICES_ARRAY);
  });

  test('should return default attorneys with feature flag off', async () => {
    const localContext = {
      ...applicationContext,
      featureFlags: { ...applicationContext.featureFlags },
    };
    localContext.featureFlags['restrict-case-assignment'] = false;

    const useCase = new OfficesUseCase();
    const repoSpy = jest.fn().mockResolvedValue([]);
    jest.spyOn(factory, 'getOfficesRepository').mockImplementation(() => {
      return {
        putOfficeStaff: jest.fn(),
        getOfficeAttorneys: repoSpy,
        close: jest.fn(),
      };
    });
    const attorneysSpy = jest.spyOn(AttorneysList.prototype, 'getAttorneyList');

    const officeCode = 'new-york';
    const officeAttorneys = await useCase.getOfficeAttorneys(localContext, officeCode);
    expect(officeAttorneys).toEqual(TRIAL_ATTORNEYS);
    expect(repoSpy).not.toHaveBeenCalled();
    expect(attorneysSpy).toHaveBeenCalledWith(localContext);
  });

  test('should return attorneys for office with feature flag on', async () => {
    const useCase = new OfficesUseCase();
    const repoSpy = jest.fn().mockResolvedValue([]);
    jest.spyOn(factory, 'getOfficesRepository').mockImplementation(() => {
      return {
        putOfficeStaff: jest.fn(),
        getOfficeAttorneys: repoSpy,
        close: jest.fn(),
      };
    });
    const attorneysSpy = jest.spyOn(AttorneysList.prototype, 'getAttorneyList');

    const officeCode = 'new-york';
    const officeAttorneys = await useCase.getOfficeAttorneys(applicationContext, officeCode);
    expect(officeAttorneys).toEqual([]);
    expect(repoSpy).toHaveBeenCalledWith(officeCode);
    expect(attorneysSpy).not.toHaveBeenCalled();
  });

  test('should persist offices', async () => {
    const seattleGroup: CamsUserGroup = { id: 'three', name: 'USTP CAMS Region 18 Office Seattle' };
    const seattleOfficeCode = 'USTP_CAMS_Region_18_Office_Seattle';
    const trialAttorneyGroup: CamsUserGroup = { id: 'four', name: 'USTP CAMS Trial Attorney' };
    const users: CamsUserReference[] = MockData.buildArray(MockData.getAttorneyUser, 4);
    const seattleUsers = [users[0], users[1], users[3]];
    const attorneyUsers = [users[1], users[2], users[3]];
    jest
      .spyOn(OktaUserGroupGateway, 'getUserGroups')
      .mockResolvedValue([
        { id: 'one', name: 'group-a' },
        { id: 'two', name: 'group-b' },
        seattleGroup,
        trialAttorneyGroup,
      ]);
    jest
      .spyOn(OktaUserGroupGateway, 'getUserGroupUsers')
      .mockImplementation(
        async (
          _context: ApplicationContext,
          _config: UserGroupGatewayConfig,
          group: CamsUserGroup,
        ) => {
          if (group.name === 'USTP CAMS Region 18 Office Seattle') {
            return Promise.resolve(seattleUsers);
          } else if (group.name === 'USTP CAMS Trial Attorney') {
            return Promise.resolve(attorneyUsers);
          } else if (group.name === 'group-a' || group.name === 'group-b') {
            throw new Error('Tried to retrieve users for invalid group.');
          }
        },
      );

    const putSpy = jest.spyOn(MockOfficesRepository, 'putOfficeStaff').mockResolvedValue();
    const stateRepoSpy = jest.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue('');

    const useCase = new OfficesUseCase();
    await useCase.syncOfficeStaff(applicationContext);
    expect(putSpy).toHaveBeenCalledTimes(seattleUsers.length);
    seattleUsers.forEach((_, idx) => {
      expect(putSpy).toHaveBeenCalledWith(seattleOfficeCode, seattleUsers[idx]);
    });
    expect(stateRepoSpy).toHaveBeenCalled();
  });
});
