import { OfficesUseCase } from './offices';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import * as factory from '../../factory';
import OktaUserGroupGateway from '../../adapters/gateways/okta/okta-user-group-gateway';
import { UserGroupGatewayConfig } from '../../adapters/types/authorization';
import { CamsUserGroup, Staff } from '../../../../common/src/cams/users';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { MOCKED_USTP_OFFICES_ARRAY, UstpDivisionMeta } from '../../../../common/src/cams/offices';
import AttorneysList from '../attorneys';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { CamsRole } from '../../../../common/src/cams/roles';
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
        getOffices: jest.fn().mockResolvedValue(MOCKED_USTP_OFFICES_ARRAY),
      };
    });

    const offices = await useCase.getOffices(applicationContext);

    expect(offices).toEqual(MOCKED_USTP_OFFICES_ARRAY);
  });

  test('should flag legacy offices', async () => {
    const useCase = new OfficesUseCase();
    const manhattanOffice = MOCKED_USTP_OFFICES_ARRAY.find(
      (office) => office.officeCode === 'USTP_CAMS_Region_2_Office_Manhattan',
    );

    const legacyDivisionCode = '087';
    const officeWithLegacyFlag = { ...manhattanOffice };
    officeWithLegacyFlag.groups[0].divisions.find(
      (d) => d.divisionCode === legacyDivisionCode,
    ).isLegacy = true;
    const expectedOffices = [officeWithLegacyFlag];

    jest.spyOn(factory, 'getOfficesGateway').mockImplementation(() => {
      return {
        getOfficeName: jest.fn(),
        getOffices: jest.fn().mockResolvedValue([manhattanOffice]),
      };
    });

    jest.spyOn(factory, 'getStorageGateway').mockImplementation(() => {
      return {
        get: jest.fn(),
        getRoleMapping: jest.fn(),
        getUstpOffices: jest.fn(),
        getUstpDivisionMeta: jest
          .fn()
          .mockReturnValue(
            new Map<string, UstpDivisionMeta>([[legacyDivisionCode, { isLegacy: true }]]),
          ),
        getPrivilegedIdentityUserRoleGroupName: jest.fn(),
      };
    });

    const offices = await useCase.getOffices(applicationContext);

    expect(offices).toEqual(expectedOffices);
  });

  test('should return attorneys for office', async () => {
    const useCase = new OfficesUseCase();
    const mockAttorneys = [];
    const repoSpy = jest.fn().mockResolvedValue(mockAttorneys);
    jest.spyOn(factory, 'getOfficesRepository').mockImplementation(() => {
      return {
        release: () => {},
        putOfficeStaff: jest.fn(),
        getOfficeAttorneys: repoSpy,
        findAndDeleteStaff: jest.fn(),
        close: jest.fn(),
      };
    });
    const attorneysSpy = jest.spyOn(AttorneysList.prototype, 'getAttorneyList');

    const officeCode = 'new-york';
    const officeAttorneys = await useCase.getOfficeAttorneys(applicationContext, officeCode);
    expect(officeAttorneys).toEqual(mockAttorneys);
    expect(repoSpy).toHaveBeenCalledWith(officeCode);
    expect(attorneysSpy).not.toHaveBeenCalled();
  });

  test('should persist offices and continue trying after error', async () => {
    const seattleGroup: CamsUserGroup = { id: 'three', name: 'USTP CAMS Region 18 Office Seattle' };
    const seattleOfficeCode = 'USTP_CAMS_Region_18_Office_Seattle';
    const trialAttorneyGroup: CamsUserGroup = { id: 'four', name: 'USTP CAMS Trial Attorney' };
    const dataVerifierGroup: CamsUserGroup = { id: 'five', name: 'USTP CAMS Data Verifier' };
    const users: Staff[] = MockData.buildArray(MockData.getAttorneyUser, 4);
    const seattleUsers = [users[0], users[1], users[3]];
    const attorneyUsers = [users[1], users[2], users[3]];
    const dataVerifierUsers = [users[3]];
    users[3].roles.push(CamsRole.DataVerifier);
    jest
      .spyOn(OktaUserGroupGateway, 'getUserGroups')
      .mockResolvedValue([
        { id: 'one', name: 'group-a' },
        { id: 'two', name: 'group-b' },
        seattleGroup,
        trialAttorneyGroup,
        dataVerifierGroup,
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
          } else if (group.name === 'USTP CAMS Data Verifier') {
            return Promise.resolve(dataVerifierUsers);
          } else if (group.name === 'group-a' || group.name === 'group-b') {
            throw new Error('Tried to retrieve users for invalid group.');
          }
        },
      );

    const putSpy = jest
      .spyOn(MockOfficesRepository, 'putOfficeStaff')
      .mockResolvedValueOnce({ id: users[1].id, modifiedCount: 1, upsertedCount: 0 })
      .mockRejectedValueOnce(new Error('some unknown error'))
      .mockResolvedValue({ id: users[3].id, modifiedCount: 0, upsertedCount: 1 });
    const stateRepoSpy = jest.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue('');
    const logSpy = jest.spyOn(applicationContext.logger, 'info').mockImplementation(() => {});

    const useCase = new OfficesUseCase();
    await useCase.syncOfficeStaff(applicationContext);
    expect(putSpy).toHaveBeenCalledTimes(seattleUsers.length);
    seattleUsers.forEach((_, idx) => {
      expect(putSpy).toHaveBeenCalledWith(seattleOfficeCode, seattleUsers[idx]);
    });
    expect(stateRepoSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.anything(), `Synced 2 users to the Seattle office.`);
    expect(logSpy).toHaveBeenCalledWith(
      expect.anything(),
      `Failed to sync 1 users to the Seattle office.`,
    );
  });
});
