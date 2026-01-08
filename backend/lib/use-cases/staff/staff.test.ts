import { vi } from 'vitest';
import StaffUseCase from './staff';
import { ApplicationContext } from '../../adapters/types/basic';
import { UserGroupsRepository } from '../gateways.types';
import { UserGroup } from '../../../../common/src/cams/users';
import * as Factory from '../../factory';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CamsRole } from '../../../../common/src/cams/roles';
import { StorageGateway } from '../../adapters/types/storage';

describe('StaffUseCase', () => {
  let mockApplicationContext: ApplicationContext;
  let mockUserGroupsRepository: vi.Mocked<UserGroupsRepository>;
  let mockStorageGateway: vi.Mocked<StorageGateway>;
  let staffUseCase: StaffUseCase;

  beforeEach(async () => {
    mockApplicationContext = await createMockApplicationContext();

    // Create mock repositories
    mockUserGroupsRepository = {
      getUserGroupsByNames: vi.fn(),
      upsertUserGroupsBatch: vi.fn(),
      release: vi.fn(),
    };

    mockStorageGateway = {
      getRoleMapping: vi.fn().mockReturnValue(
        new Map([
          ['USTP CAMS Trial Attorney', CamsRole.OversightAttorney],
          ['USTP CAMS Auditor', CamsRole.OversightAuditor],
          ['USTP CAMS Paralegal', CamsRole.OversightParalegal],
          ['USTP CAMS Super User', CamsRole.SuperUser], // Non-oversight role
        ]),
      ),
      get: vi.fn(),
      getPrivilegedIdentityUserRoleGroupName: vi.fn(),
    };

    // Mock factory functions using spyOn
    vi.spyOn(Factory, 'getUserGroupsRepository').mockReturnValue(mockUserGroupsRepository);
    vi.spyOn(Factory, 'getStorageGateway').mockReturnValue(mockStorageGateway);

    staffUseCase = new StaffUseCase(mockApplicationContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getOversightStaff', () => {
    test('should return oversight staff grouped by role', async () => {
      const mockGroups: UserGroup[] = [
        {
          id: '1',
          groupName: 'USTP CAMS Trial Attorney',
          users: [
            { id: 'u1', name: 'Attorney 1' },
            { id: 'u2', name: 'Attorney 2' },
          ],
        },
        {
          id: '2',
          groupName: 'USTP CAMS Auditor',
          users: [{ id: 'u3', name: 'Auditor 1' }],
        },
        {
          id: '3',
          groupName: 'USTP CAMS Paralegal',
          users: [{ id: 'u4', name: 'Paralegal 1' }],
        },
      ];

      mockUserGroupsRepository.getUserGroupsByNames.mockResolvedValue(mockGroups);

      const result = await staffUseCase.getOversightStaff(mockApplicationContext);

      expect(result).toEqual({
        [CamsRole.OversightAttorney]: [
          { id: 'u1', name: 'Attorney 1', roles: [CamsRole.OversightAttorney] },
          { id: 'u2', name: 'Attorney 2', roles: [CamsRole.OversightAttorney] },
        ],
        [CamsRole.OversightAuditor]: [
          { id: 'u3', name: 'Auditor 1', roles: [CamsRole.OversightAuditor] },
        ],
        [CamsRole.OversightParalegal]: [
          { id: 'u4', name: 'Paralegal 1', roles: [CamsRole.OversightParalegal] },
        ],
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
        { id: '1', groupName: 'USTP CAMS Trial Attorney', users: [] },
      ];

      mockUserGroupsRepository.getUserGroupsByNames.mockResolvedValue(mockGroups);

      const result = await staffUseCase.getOversightStaff(mockApplicationContext);

      expect(result).toEqual({
        TrialAttorney: [],
        Auditor: [],
        Paralegal: [],
      });
    });

    test('should handle when no groups are found', async () => {
      mockUserGroupsRepository.getUserGroupsByNames.mockResolvedValue([]);

      const result = await staffUseCase.getOversightStaff(mockApplicationContext);

      expect(result).toEqual({
        TrialAttorney: [],
        Auditor: [],
        Paralegal: [],
      });
    });

    test('should log retrieved group count', async () => {
      mockUserGroupsRepository.getUserGroupsByNames.mockResolvedValue([
        { id: '1', groupName: 'USTP CAMS Trial Attorney', users: [] },
        { id: '2', groupName: 'USTP CAMS Auditor', users: [] },
      ]);
      const loggerSpy = vi.spyOn(mockApplicationContext.logger, 'info');

      await staffUseCase.getOversightStaff(mockApplicationContext);

      expect(loggerSpy).toHaveBeenCalledWith('STAFF-USE-CASE', 'Retrieved 2 oversight role groups');
    });

    test('should handle repository errors gracefully', async () => {
      const expectedError = new Error('Database connection failed');
      mockUserGroupsRepository.getUserGroupsByNames.mockRejectedValue(expectedError);

      await expect(staffUseCase.getOversightStaff(mockApplicationContext)).rejects.toThrow(
        'Database connection failed',
      );
      expect(mockUserGroupsRepository.getUserGroupsByNames).toHaveBeenCalledWith(
        mockApplicationContext,
        expect.any(Array),
      );
    });

    test('should skip groups with no matching role in mapping', async () => {
      const mockGroups: UserGroup[] = [
        {
          id: '1',
          groupName: 'USTP CAMS Trial Attorney',
          users: [{ id: 'u1', name: 'Attorney 1' }],
        },
        {
          id: '2',
          groupName: 'Unknown Group Name',
          users: [{ id: 'u2', name: 'Unknown User' }],
        },
      ];

      mockUserGroupsRepository.getUserGroupsByNames.mockResolvedValue(mockGroups);

      const result = await staffUseCase.getOversightStaff(mockApplicationContext);

      expect(result).toEqual({
        [CamsRole.OversightAttorney]: [
          { id: 'u1', name: 'Attorney 1', roles: [CamsRole.OversightAttorney] },
        ],
        [CamsRole.OversightAuditor]: [],
        [CamsRole.OversightParalegal]: [],
      });
      // Unknown group should be skipped, not throw an error
    });

    test('should call factory methods with correct context', async () => {
      mockUserGroupsRepository.getUserGroupsByNames.mockResolvedValue([]);

      await staffUseCase.getOversightStaff(mockApplicationContext);

      expect(Factory.getStorageGateway).toHaveBeenCalledWith(mockApplicationContext);
      expect(mockUserGroupsRepository.getUserGroupsByNames).toHaveBeenCalled();
    });

    test('should handle partial data with some roles having users and others empty', async () => {
      const mockGroups: UserGroup[] = [
        {
          id: '1',
          groupName: 'USTP CAMS Trial Attorney',
          users: [{ id: 'u1', name: 'Attorney 1' }],
        },
        {
          id: '2',
          groupName: 'USTP CAMS Auditor',
          users: [],
        },
        {
          id: '3',
          groupName: 'USTP CAMS Paralegal',
          users: [
            { id: 'u2', name: 'Paralegal 1' },
            { id: 'u3', name: 'Paralegal 2' },
          ],
        },
      ];

      mockUserGroupsRepository.getUserGroupsByNames.mockResolvedValue(mockGroups);

      const result = await staffUseCase.getOversightStaff(mockApplicationContext);

      expect(result).toEqual({
        [CamsRole.OversightAttorney]: [
          { id: 'u1', name: 'Attorney 1', roles: [CamsRole.OversightAttorney] },
        ],
        [CamsRole.OversightAuditor]: [],
        [CamsRole.OversightParalegal]: [
          { id: 'u2', name: 'Paralegal 1', roles: [CamsRole.OversightParalegal] },
          { id: 'u3', name: 'Paralegal 2', roles: [CamsRole.OversightParalegal] },
        ],
      });
    });
  });
});
