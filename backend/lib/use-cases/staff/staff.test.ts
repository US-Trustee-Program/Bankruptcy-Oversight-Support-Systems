import StaffUseCase from './staff';
import { ApplicationContext } from '../../adapters/types/basic';
import { UserGroupsRepository } from '../gateways.types';
import { UserGroup } from '../../../../common/src/cams/users';
import { getUserGroupsRepository, getStorageGateway } from '../../factory';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CamsRole } from '../../../../common/src/cams/roles';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';

jest.mock('../../factory');

describe('StaffUseCase', () => {
  let mockApplicationContext: ApplicationContext;
  let mockUserGroupsRepository: jest.Mocked<UserGroupsRepository>;
  let mockStorageGateway: { getRoleMapping: jest.Mock };
  let staffUseCase: StaffUseCase;

  beforeEach(async () => {
    mockApplicationContext = await createMockApplicationContext();

    mockUserGroupsRepository = {
      getUserGroupsByNames: jest.fn(),
      upsertUserGroupsBatch: jest.fn(),
      release: jest.fn(),
    };

    mockStorageGateway = {
      getRoleMapping: jest.fn().mockReturnValue(
        new Map([
          ['USTP CAMS Trial Attorney', CamsRole.TrialAttorney],
          ['USTP CAMS Auditor', CamsRole.Auditor],
          ['USTP CAMS Paralegal', CamsRole.Paralegal],
          ['USTP CAMS Super User', CamsRole.SuperUser],
        ]),
      ),
    };

    (getUserGroupsRepository as jest.Mock).mockReturnValue(mockUserGroupsRepository);
    (getStorageGateway as jest.Mock).mockReturnValue(mockStorageGateway);

    staffUseCase = new StaffUseCase(mockApplicationContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize userGroupsRepository through factory', () => {
      expect(getUserGroupsRepository).toHaveBeenCalledWith(mockApplicationContext);
      expect(staffUseCase.userGroupsRepository).toBe(mockUserGroupsRepository);
    });

    test('should create instance with different application context', async () => {
      const anotherContext = await createMockApplicationContext();
      const anotherStaffUseCase = new StaffUseCase(anotherContext);

      expect(getUserGroupsRepository).toHaveBeenCalledWith(anotherContext);
      expect(anotherStaffUseCase.userGroupsRepository).toBe(mockUserGroupsRepository);
    });
  });

  describe('getOversightStaff', () => {
    test('should return oversight staff grouped by role', async () => {
      const mockGroups: UserGroup[] = [
        {
          id: '1',
          groupName: 'USTP CAMS Trial Attorney',
          users: [
            MockData.getCamsUserReference({ id: 'u1', name: 'Attorney 1' }),
            MockData.getCamsUserReference({ id: 'u2', name: 'Attorney 2' }),
          ],
        },
        {
          id: '2',
          groupName: 'USTP CAMS Auditor',
          users: [MockData.getCamsUserReference({ id: 'u3', name: 'Auditor 1' })],
        },
        {
          id: '3',
          groupName: 'USTP CAMS Paralegal',
          users: [MockData.getCamsUserReference({ id: 'u4', name: 'Paralegal 1' })],
        },
      ];

      mockUserGroupsRepository.getUserGroupsByNames.mockResolvedValue(mockGroups);

      const result = await staffUseCase.getOversightStaff(mockApplicationContext);

      expect(result).toEqual({
        TrialAttorney: [
          expect.objectContaining({ id: 'u1', name: 'Attorney 1' }),
          expect.objectContaining({ id: 'u2', name: 'Attorney 2' }),
        ],
        Auditor: [expect.objectContaining({ id: 'u3', name: 'Auditor 1' })],
        Paralegal: [expect.objectContaining({ id: 'u4', name: 'Paralegal 1' })],
      });
    });

    test('should call getUserGroupsByNames with oversight group names only', async () => {
      mockUserGroupsRepository.getUserGroupsByNames.mockResolvedValue([]);

      await staffUseCase.getOversightStaff(mockApplicationContext);

      expect(mockUserGroupsRepository.getUserGroupsByNames).toHaveBeenCalledWith(
        mockApplicationContext,
        expect.arrayContaining([
          'USTP CAMS Trial Attorney',
          'USTP CAMS Auditor',
          'USTP CAMS Paralegal',
        ]),
      );

      // Should NOT include non-oversight roles
      const calledWith = mockUserGroupsRepository.getUserGroupsByNames.mock.calls[0][1];
      expect(calledWith).not.toContain('USTP CAMS Super User');
    });

    test('should handle empty user arrays gracefully', async () => {
      const mockGroups: UserGroup[] = [
        {
          id: '1',
          groupName: 'USTP CAMS Trial Attorney',
          users: [],
        },
      ];

      mockUserGroupsRepository.getUserGroupsByNames.mockResolvedValue(mockGroups);

      const result = await staffUseCase.getOversightStaff(mockApplicationContext);

      expect(result).toEqual({
        TrialAttorney: [],
      });
    });

    test('should log retrieved group count', async () => {
      mockUserGroupsRepository.getUserGroupsByNames.mockResolvedValue([
        { id: '1', groupName: 'USTP CAMS Trial Attorney', users: [] },
        { id: '2', groupName: 'USTP CAMS Auditor', users: [] },
      ]);
      const loggerSpy = jest.spyOn(mockApplicationContext.logger, 'info');

      await staffUseCase.getOversightStaff(mockApplicationContext);

      expect(loggerSpy).toHaveBeenCalledWith('STAFF-USE-CASE', 'Retrieved 2 oversight role groups');
    });

    test('should handle repository errors gracefully', async () => {
      const expectedError = new Error('Database connection failed');
      mockUserGroupsRepository.getUserGroupsByNames.mockRejectedValue(expectedError);

      await expect(staffUseCase.getOversightStaff(mockApplicationContext)).rejects.toThrow(
        'Database connection failed',
      );
    });

    test('should return empty Record when no groups found', async () => {
      mockUserGroupsRepository.getUserGroupsByNames.mockResolvedValue([]);

      const result = await staffUseCase.getOversightStaff(mockApplicationContext);

      expect(result).toEqual({});
    });
  });
});
