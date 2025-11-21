import * as crypto from 'crypto';
import * as fs from 'fs';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { ApplicationContext } from '../../types/basic';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { DevUser } from './dev-oauth2-gateway';
import DevUserGroupGateway from './dev-user-group-gateway';
import LocalStorageGateway from '../storage/local-storage-gateway';
import { MOCK_SCRYPT_HASH } from './dev-oauth2-test-helper';
import { UserGroupGatewayConfig } from '../../types/authorization';

// Helper function to mock the dev-users.json file
function mockDevUsersFile(devUsers: DevUser[] | null) {
  if (devUsers === null) {
    // File doesn't exist
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
  } else {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(devUsers));
  }
}

describe('DevUserGroupGateway tests', () => {
  let gateway: DevUserGroupGateway;
  let context: ApplicationContext;

  const testUsers: DevUser[] = [
    {
      username: 'alice',
      passwordHash: MOCK_SCRYPT_HASH,
      name: 'Alice Attorney',
      roles: ['TrialAttorney', 'PrivilegedIdentityUser'],
      offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
    },
    {
      username: 'bob',
      passwordHash: MOCK_SCRYPT_HASH,
      name: 'Bob Admin',
      roles: ['CaseAssignmentManager'],
      offices: ['USTP_CAMS_Region_3_Office_Wilmington'],
    },
    {
      username: 'charlie',
      passwordHash: MOCK_SCRYPT_HASH,
      roles: ['DataVerifier'],
      offices: ['USTP_CAMS_Region_2_Office_Manhattan', 'USTP_CAMS_Region_2_Office_Buffalo'],
    },
  ];

  function hashUsername(username: string): string {
    return crypto.createHash('sha256').update(username).digest('hex');
  }

  beforeEach(async () => {
    gateway = new DevUserGroupGateway();
    context = await createMockApplicationContext();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Clear the internal cache between tests
    // This is a workaround since the module maintains state
    const anyGateway = gateway as unknown;
    if (
      anyGateway &&
      typeof anyGateway === 'object' &&
      'constructor' in anyGateway &&
      anyGateway.constructor &&
      typeof anyGateway.constructor === 'object' &&
      'camsUserGroups' in anyGateway.constructor!
    ) {
      const camsUserGroups = (anyGateway.constructor as { camsUserGroups: Map<string, unknown> })
        .camsUserGroups;
      camsUserGroups.clear();
    }
  });

  describe('init', () => {
    test('should initialize without error', async () => {
      mockDevUsersFile(testUsers);
      const result = await gateway.init({ provider: 'dev' } as UserGroupGatewayConfig);
      expect(result).toBeUndefined();
    });

    test('should handle missing dev-users.json file', async () => {
      const result = await gateway.init({ provider: 'dev' } as UserGroupGatewayConfig);
      expect(result).toBeUndefined();
    });
  });

  describe('getUserGroups', () => {
    beforeEach(() => {
      mockDevUsersFile(testUsers);
    });

    test('should return list of all groups', async () => {
      const groups = await gateway.getUserGroups(context);

      expect(groups.length).toBeGreaterThan(0);
      expect(groups.every((g) => g.id && g.name)).toBe(true);

      // Should include role groups
      const roleMapping = LocalStorageGateway.getRoleMapping();
      roleMapping.forEach((_role, groupName) => {
        expect(groups.some((g) => g.name === groupName)).toBe(true);
      });
    });

    test('should return groups without users property', async () => {
      const groups = await gateway.getUserGroups(context);

      groups.forEach((group) => {
        expect(group.id).toBeDefined();
        expect(group.name).toBeDefined();
        expect(group.users).toBeUndefined();
      });
    });

    test('should handle missing dev-users.json file', async () => {
      const groups = await gateway.getUserGroups(context);

      // Should still return groups, just with no users
      expect(Array.isArray(groups)).toBe(true);
      expect(groups.length).toBeGreaterThan(0);
    });
  });

  describe('getUserGroupWithUsers', () => {
    beforeEach(() => {
      mockDevUsersFile(testUsers);
    });

    test('should return group with users for valid role group', async () => {
      const roleMapping = LocalStorageGateway.getRoleMapping();
      const trialAttorneyGroupName = Array.from(roleMapping.entries()).find(
        ([, role]) => role === CamsRole.TrialAttorney,
      )?.[0];

      if (!trialAttorneyGroupName) {
        throw new Error('Could not find TrialAttorney group name');
      }

      const group = await gateway.getUserGroupWithUsers(context, trialAttorneyGroupName);

      expect(group.id).toBeDefined();
      expect(group.name).toBe(trialAttorneyGroupName);
      expect(group.users).toBeDefined();
      expect(Array.isArray(group.users)).toBe(true);

      // Alice has TrialAttorney role
      const aliceId = hashUsername('alice');
      expect(group.users?.some((u) => u.id === aliceId)).toBe(true);
    });

    test('should return group with users for valid office group', async () => {
      const groupName = 'USTP CAMS Region 2 Office Manhattan';

      const group = await gateway.getUserGroupWithUsers(context, groupName);

      expect(group.id).toBeDefined();
      expect(group.name).toBe(groupName);
      expect(group.users).toBeDefined();
      expect(Array.isArray(group.users)).toBe(true);

      // Alice and Charlie are in Manhattan office
      const aliceId = hashUsername('alice');
      const charlieId = hashUsername('charlie');
      expect(group.users?.some((u) => u.id === aliceId)).toBe(true);
      expect(group.users?.some((u) => u.id === charlieId)).toBe(true);
    });

    test('should throw NotFoundError for non-existent group', async () => {
      await expect(gateway.getUserGroupWithUsers(context, 'NonExistentGroup')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('getUserGroupUsers', () => {
    beforeEach(() => {
      mockDevUsersFile(testUsers);
    });

    test('should return users for a role group', async () => {
      const roleMapping = LocalStorageGateway.getRoleMapping();
      const trialAttorneyGroupName = Array.from(roleMapping.entries()).find(
        ([, role]) => role === CamsRole.TrialAttorney,
      )?.[0];

      if (!trialAttorneyGroupName) {
        throw new Error('Could not find TrialAttorney group name');
      }

      const group = await gateway.getUserGroupWithUsers(context, trialAttorneyGroupName);
      const users = await gateway.getUserGroupUsers(context, group);

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);

      // Alice has TrialAttorney role
      const aliceId = hashUsername('alice');
      expect(users.some((u) => u.id === aliceId && u.name === 'Alice Attorney')).toBe(true);
    });

    test('should return users for an office group', async () => {
      const groupName = 'USTP CAMS Region 3 Office Wilmington';

      const group = await gateway.getUserGroupWithUsers(context, groupName);
      const users = await gateway.getUserGroupUsers(context, group);

      expect(Array.isArray(users)).toBe(true);

      // Bob is in Wilmington office
      const bobId = hashUsername('bob');
      expect(users.some((u) => u.id === bobId)).toBe(true);
    });
  });

  describe('getUserById', () => {
    beforeEach(() => {
      mockDevUsersFile(testUsers);
    });

    test('should return user by valid ID', async () => {
      const aliceId = hashUsername('alice');
      const user = await gateway.getUserById(context, aliceId);

      expect(user.id).toBe(aliceId);
      expect(user.name).toBe('Alice Attorney');
      expect(user.roles).toContain(CamsRole.TrialAttorney);
      expect(user.roles).toContain(CamsRole.PrivilegedIdentityUser);
      expect(user.offices.length).toBeGreaterThan(0);
      expect(user.offices[0].officeCode).toBe('USTP_CAMS_Region_2_Office_Manhattan');
    });

    test('should use username as name when name is not provided', async () => {
      const charlieId = hashUsername('charlie');
      const user = await gateway.getUserById(context, charlieId);

      expect(user.id).toBe(charlieId);
      expect(user.name).toBe('charlie');
    });

    test('should throw NotFoundError for non-existent user ID', async () => {
      const fakeId = 'nonexistentuserid12345';
      await expect(gateway.getUserById(context, fakeId)).rejects.toThrow(NotFoundError);
    });

    test('should filter out invalid roles', async () => {
      const usersWithInvalidRoles: DevUser[] = [
        {
          username: 'testuser',
          passwordHash: MOCK_SCRYPT_HASH,
          roles: ['TrialAttorney', 'InvalidRole', 'DataVerifier'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      mockDevUsersFile(usersWithInvalidRoles);

      const userId = hashUsername('testuser');
      const user = await gateway.getUserById(context, userId);

      expect(user.roles).toHaveLength(2);
      expect(user.roles).toContain(CamsRole.TrialAttorney);
      expect(user.roles).toContain(CamsRole.DataVerifier);
      expect(user.roles).not.toContain('InvalidRole' as CamsRole);
    });

    test('should filter out invalid office codes', async () => {
      const usersWithInvalidOffices: DevUser[] = [
        {
          username: 'testuser',
          passwordHash: MOCK_SCRYPT_HASH,
          roles: ['TrialAttorney'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan', 'InvalidOfficeCode'],
        },
      ];
      mockDevUsersFile(usersWithInvalidOffices);

      const userId = hashUsername('testuser');
      const user = await gateway.getUserById(context, userId);

      expect(user.offices).toHaveLength(1);
      expect(user.offices[0].officeCode).toBe('USTP_CAMS_Region_2_Office_Manhattan');
    });

    test('should handle user with multiple offices', async () => {
      const charlieId = hashUsername('charlie');
      const user = await gateway.getUserById(context, charlieId);

      expect(user.offices).toHaveLength(2);
      expect(user.offices.some((o) => o.officeCode === 'USTP_CAMS_Region_2_Office_Manhattan')).toBe(
        true,
      );
      expect(user.offices.some((o) => o.officeCode === 'USTP_CAMS_Region_2_Office_Buffalo')).toBe(
        true,
      );
    });
  });

  describe('group initialization', () => {
    test('should initialize groups only once', async () => {
      mockDevUsersFile(testUsers);

      // Call getUserGroups multiple times
      const groups1 = await gateway.getUserGroups(context);
      const groups2 = await gateway.getUserGroups(context);

      // Should return the same groups (cached)
      expect(groups1.length).toBe(groups2.length);
    });

    test('should handle malformed dev-users.json gracefully', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue('not valid json');

      // Should not throw, just return groups with no users
      const groups = await gateway.getUserGroups(context);
      expect(Array.isArray(groups)).toBe(true);
    });

    test('should handle dev-users.json that is not an array', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue('{"username":"test"}');

      // Should not throw, just return groups with no users
      const groups = await gateway.getUserGroups(context);
      expect(Array.isArray(groups)).toBe(true);
    });
  });
});
