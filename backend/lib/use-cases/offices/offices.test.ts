import { OfficesUseCase } from './offices';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import * as factory from '../../factory';
import { CamsUserGroup, Staff } from '../../../../common/src/cams/users';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { MOCKED_USTP_OFFICES_ARRAY } from '../../../../common/src/cams/offices';
import StaffUseCase from '../staff/staff';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { CamsRole } from '../../../../common/src/cams/roles';
import UsersHelpers from '../users/users.helpers';
import MockUserGroupGateway from '../../testing/mock-gateways/mock-user-group-gateway';
import { buildOfficeCode, getOfficeName } from './offices';

const MANHATTAN_OFFICE = MOCKED_USTP_OFFICES_ARRAY.find(
  (office) => office.officeCode === 'USTP_CAMS_Region_2_Office_Manhattan',
);
const SEATTLE_OFFICE = MOCKED_USTP_OFFICES_ARRAY.find(
  (office) => office.officeCode === 'USTP_CAMS_Region_18_Office_Seattle',
);

describe('offices use case tests', () => {
  let applicationContext: ApplicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
    jest.spyOn(MockUserGroupGateway.prototype, 'init').mockResolvedValue();
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

  test('should return attorneys for office', async () => {
    const useCase = new OfficesUseCase();
    const mockAttorneys = [];
    const repoSpy = jest
      .spyOn(MockMongoRepository.prototype, 'getOfficeAttorneys')
      .mockResolvedValue(mockAttorneys);
    const attorneysSpy = jest.spyOn(StaffUseCase.prototype, 'getOversightStaff');

    const { officeCode } = MANHATTAN_OFFICE;
    const officeAttorneys = await useCase.getOfficeAttorneys(applicationContext, officeCode);
    expect(officeAttorneys).toEqual(mockAttorneys);
    expect(repoSpy).toHaveBeenCalledWith(officeCode);
    expect(attorneysSpy).not.toHaveBeenCalled();
  });

  test('should return assigned attorneys for office', async () => {
    const useCase = new OfficesUseCase();
    const attorneys = MockData.buildArray(MockData.getCamsUserReference, 5);
    const repoSpy = jest
      .spyOn(MockMongoRepository.prototype, 'getDistinctAssigneesByOffice')
      .mockResolvedValue(attorneys);

    const { officeCode } = MANHATTAN_OFFICE;

    const actual = await useCase.getOfficeAssignees(applicationContext, officeCode);
    expect(actual).toEqual(attorneys);
    expect(repoSpy).toHaveBeenCalledWith(officeCode);
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
          // Return empty array for non-CAMS groups (for user-groups collection sync)
          return Promise.resolve([]);
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
      .spyOn(MockMongoRepository.prototype, 'putOfficeStaff')
      .mockResolvedValueOnce({ id: users[1].id, modifiedCount: 1, upsertedCount: 0 })
      .mockRejectedValueOnce(new Error('some unknown error'))
      .mockResolvedValue({ id: users[3].id, modifiedCount: 0, upsertedCount: 1 });
    jest.spyOn(MockMongoRepository.prototype, 'upsertUserGroupsBatch').mockResolvedValue();
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

  test('should log only success when all users are synced successfully', async () => {
    const officeGroup: CamsUserGroup = { id: 'three', name: 'USTP CAMS Region 18 Office Seattle' };
    const users: Staff[] = MockData.buildArray(MockData.getAttorneyUser, 3);
    jest.spyOn(MockUserGroupGateway.prototype, 'getUserGroups').mockResolvedValue([officeGroup]);
    jest.spyOn(MockUserGroupGateway.prototype, 'getUserGroupUsers').mockResolvedValue(users);
    jest
      .spyOn(UsersHelpers, 'getPrivilegedIdentityUser')
      .mockImplementation(async (_context, userId) => {
        const user = users.find((u) => u.id === userId);
        return { ...user };
      });
    const putSpy = jest
      .spyOn(MockMongoRepository.prototype, 'putOfficeStaff')
      .mockResolvedValue({});
    jest.spyOn(MockMongoRepository.prototype, 'upsertUserGroupsBatch').mockResolvedValue();
    const logSpy = jest.spyOn(applicationContext.logger, 'info').mockImplementation(() => {});
    jest.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue('');
    const useCase = new OfficesUseCase();
    await useCase.syncOfficeStaff(applicationContext);
    expect(putSpy).toHaveBeenCalledTimes(users.length);
    expect(logSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Synced 3 users'),
    );
    expect(logSpy).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Failed to sync'),
    );
  });

  test('should log only failure when all users fail to sync', async () => {
    const officeGroup: CamsUserGroup = { id: 'three', name: 'USTP CAMS Region 18 Office Seattle' };
    const users: Staff[] = MockData.buildArray(MockData.getAttorneyUser, 2);
    jest.spyOn(MockUserGroupGateway.prototype, 'getUserGroups').mockResolvedValue([officeGroup]);
    jest.spyOn(MockUserGroupGateway.prototype, 'getUserGroupUsers').mockResolvedValue(users);
    jest
      .spyOn(UsersHelpers, 'getPrivilegedIdentityUser')
      .mockImplementation(async (_context, userId) => {
        const user = users.find((u) => u.id === userId);
        return { ...user };
      });
    const putSpy = jest
      .spyOn(MockMongoRepository.prototype, 'putOfficeStaff')
      .mockRejectedValue(new Error('fail'));
    jest.spyOn(MockMongoRepository.prototype, 'upsertUserGroupsBatch').mockResolvedValue();
    const logSpy = jest.spyOn(applicationContext.logger, 'info').mockImplementation(() => {});
    jest.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue('');
    const useCase = new OfficesUseCase();
    await useCase.syncOfficeStaff(applicationContext);
    expect(putSpy).toHaveBeenCalledTimes(users.length);
    expect(logSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Failed to sync 2 users'),
    );
    expect(logSpy).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/Synced \d+ users/),
    );
  });
});

describe('offices utility functions', () => {
  // Use a real mapped division code from USTP_OFFICE_NAME_MAP
  const mappedDivisionCode = '001'; // Portland (from real map)
  const mappedOfficeName = 'Portland';
  const unmappedDivisionCode = 'ZZZ';

  test('buildOfficeCode returns expected AD group name for mapped and unmapped codes', () => {
    expect(buildOfficeCode('2', mappedDivisionCode)).toBe(
      `USTP_CAMS_Region_2_Office_${mappedOfficeName}`,
    );
    expect(buildOfficeCode('2', unmappedDivisionCode)).toBe(
      'USTP_CAMS_Region_2_Office_UNKNOWN_ZZZ',
    );
  });

  test('getOfficeName returns mapped name if present', () => {
    expect(getOfficeName(mappedDivisionCode)).toBe(mappedOfficeName);
  });

  test('getOfficeName returns UNKNOWN_ if not mapped', () => {
    expect(getOfficeName(unmappedDivisionCode)).toBe('UNKNOWN_ZZZ');
  });

  test('buildOfficeCode indirectly tests cleanOfficeName (spaces and special chars)', () => {
    // This division code will be unmapped, so office name will be UNKNOWN_... and cleanOfficeName will run
    expect(buildOfficeCode('2', 'A B C!@#')).toBe('USTP_CAMS_Region_2_Office_UNKNOWN_A_B_C');
  });
});
