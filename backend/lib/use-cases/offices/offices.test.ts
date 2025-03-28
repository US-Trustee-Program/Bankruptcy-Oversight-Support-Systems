import { OfficesUseCase } from './offices';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import * as factory from '../../factory';
import { CamsUserGroup, Staff } from '../../../../common/src/cams/users';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { MOCKED_USTP_OFFICES_ARRAY, UstpDivisionMeta } from '../../../../common/src/cams/offices';
import AttorneysList from '../attorneys/attorneys';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { CamsRole } from '../../../../common/src/cams/roles';
import { MockOfficesRepository } from '../../testing/mock-gateways/mock.offices.repository';
import UsersHelpers from '../users/users.helpers';
import MockUserGroupGateway from '../../testing/mock-gateways/mock-user-group-gateway';
import { getCamsUserReference } from '../../../../common/src/cams/session';
import { ustpOfficeToDivision } from '../../testing/analysis/acms-dxtr-divisions/compare-divisions';

const MANHATTAN_OFFICE = MOCKED_USTP_OFFICES_ARRAY.find(
  (office) => office.officeCode === 'USTP_CAMS_Region_2_Office_Manhattan',
);
const SEATTLE_OFFICE = MOCKED_USTP_OFFICES_ARRAY.find(
  (office) => office.officeCode === 'USTP_CAMS_Region_18_Office_Seattle',
);

describe('offices use case tests', () => {
  let applicationContext: ApplicationContext;
  jest.spyOn(MockUserGroupGateway.prototype, 'init').mockResolvedValue();

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

    const legacyDivisionCode = '087';
    const officeWithLegacyFlag = { ...MANHATTAN_OFFICE };
    officeWithLegacyFlag.groups[0].divisions.find(
      (d) => d.divisionCode === legacyDivisionCode,
    ).isLegacy = true;
    const expectedOffices = [officeWithLegacyFlag];

    jest.spyOn(factory, 'getOfficesGateway').mockImplementation(() => {
      return {
        getOfficeName: jest.fn(),
        getOffices: jest.fn().mockResolvedValue([MANHATTAN_OFFICE]),
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
        putOrExtendOfficeStaff: jest.fn(),
        getOfficeAssignments: jest.fn(),
        close: jest.fn(),
      };
    });
    const attorneysSpy = jest.spyOn(AttorneysList.prototype, 'getAttorneyList');

    const { officeCode } = MANHATTAN_OFFICE;
    const officeAttorneys = await useCase.getOfficeAttorneys(applicationContext, officeCode);
    expect(officeAttorneys).toEqual(mockAttorneys);
    expect(repoSpy).toHaveBeenCalledWith(officeCode);
    expect(attorneysSpy).not.toHaveBeenCalled();
  });

  test('should return assigned attorneys for office', async () => {
    const useCase = new OfficesUseCase();
    const attorneys = MockData.buildArray(MockData.getAttorneyUser, 5);
    const assignments = [];
    attorneys.forEach((attorney) => {
      assignments.push(
        ...MockData.buildArray(
          () => MockData.getAttorneyAssignment({ name: attorney.name, userId: attorney.id }),
          5,
        ),
      );
    });
    const cases = MockData.buildArray(MockData.getCaseSummary, 25);
    for (let i = 0; i < cases.length; i++) {
      cases[i].assignments = [assignments[i]];
    }
    const expected = attorneys.map((attorney) => {
      return getCamsUserReference(attorney);
    });
    const repoSpy = jest
      .spyOn(MockMongoRepository.prototype, 'searchCasesForOfficeAssignees')
      .mockResolvedValue(cases);

    const { officeCode } = MANHATTAN_OFFICE;

    const expectedPredicate = {
      divisionCodes: ustpOfficeToDivision(MANHATTAN_OFFICE).map((div) => div.dxtrDivisionCode),
      excludeClosedCases: true,
    };

    const actual = await useCase.getOfficeAssignees(applicationContext, officeCode);
    expect(actual).toEqual(expected);
    expect(repoSpy).toHaveBeenCalledWith(expectedPredicate);
  });

  test('should persist offices and continue trying after error', async () => {
    const seattleGroup: CamsUserGroup = { id: 'three', name: 'USTP CAMS Region 18 Office Seattle' };
    const seattleOfficeCode = SEATTLE_OFFICE.officeCode;
    const trialAttorneyGroup: CamsUserGroup = { id: 'four', name: 'USTP CAMS Trial Attorney' };
    const dataVerifierGroup: CamsUserGroup = { id: 'five', name: 'USTP CAMS Data Verifier' };
    const users: Staff[] = MockData.buildArray(MockData.getAttorneyUser, 4);
    const seattleUsers = [users[0], users[1], users[3]];
    const attorneyUsers = [users[1], users[2], users[3]];
    const dataVerifierUsers = [users[3]];
    users[3].roles.push(CamsRole.DataVerifier);
    jest
      .spyOn(MockUserGroupGateway.prototype, 'getUserGroups')
      .mockResolvedValue([
        { id: 'one', name: 'group-a' },
        { id: 'two', name: 'group-b' },
        seattleGroup,
        trialAttorneyGroup,
        dataVerifierGroup,
      ]);
    jest
      .spyOn(MockUserGroupGateway.prototype, 'getUserGroupUsers')
      .mockImplementation(async (_context: ApplicationContext, group: CamsUserGroup) => {
        if (group.name === 'USTP CAMS Region 18 Office Seattle') {
          return Promise.resolve(seattleUsers);
        } else if (group.name === 'USTP CAMS Trial Attorney') {
          return Promise.resolve(attorneyUsers);
        } else if (group.name === 'USTP CAMS Data Verifier') {
          return Promise.resolve(dataVerifierUsers);
        } else if (group.name === 'group-a' || group.name === 'group-b') {
          throw new Error('Tried to retrieve users for invalid group.');
        }
      });

    jest
      .spyOn(UsersHelpers, 'getPrivilegedIdentityUser')
      .mockImplementation(async (_context: ApplicationContext, userId: string) => {
        const user = { id: userId, name: '', roles: [], offices: [] };
        users.forEach((staff) => {
          if (staff.id === userId) {
            user.name = staff.name;
            user.roles = staff.roles;
          }
        });
        return user;
      });
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
