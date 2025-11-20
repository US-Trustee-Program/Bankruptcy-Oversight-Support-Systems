import * as jwt from 'jsonwebtoken';
import { DevUserSessionUseCase } from './dev-user-session-use-case';
import { ApplicationContext } from '../../types/basic';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { MOCK_SCRYPT_HASH } from './dev-oauth2-test-helper';

describe('DevUserSessionUseCase tests', () => {
  const testUsername = 'testuser';

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.DEV_USERS;
  });

  const createMockContext = (provider: string = 'dev'): ApplicationContext => {
    return {
      config: {
        authConfig: {
          provider,
        },
      },
      request: {
        url: 'http://localhost:3000/api/oauth2/default',
      },
    } as unknown as ApplicationContext;
  };

  const createTestToken = (username: string, expiresIn: number = 3600, iat?: number): string => {
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      aud: 'api://default',
      sub: username,
      iss: 'http://localhost:3000/api/oauth2/default',
      exp: now + expiresIn,
      iat: iat !== undefined ? iat : now,
      groups: ['TrialAttorney'],
    };
    return jwt.sign(claims, 'dev-oauth2-secret');
  };

  const setupDevUser = () => {
    const devUsers = [
      {
        username: testUsername,
        passwordHash: MOCK_SCRYPT_HASH,
        name: 'Test User',
        roles: ['TrialAttorney'],
        offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
      },
    ];
    process.env.DEV_USERS = JSON.stringify(devUsers);
  };

  describe('lookup', () => {
    test('should return session for valid token', async () => {
      setupDevUser();
      const context = createMockContext();
      const token = createTestToken(testUsername);
      const useCase = new DevUserSessionUseCase();

      const session = await useCase.lookup(context, token);

      expect(session).toBeDefined();
      expect(session.user).toBeDefined();
      expect(session.user.name).toBe('Test User');
      expect(session.user.id).toBe(testUsername);
      expect(session.accessToken).toBe(token);
      expect(session.provider).toBe('dev');
    });

    test('should include correct issuer in session', async () => {
      setupDevUser();
      const context = createMockContext();
      const token = createTestToken(testUsername);
      const useCase = new DevUserSessionUseCase();

      const session = await useCase.lookup(context, token);

      expect(session.issuer).toBe('http://localhost:3000/api/oauth2/default');
    });

    test('should include correct expires timestamp in session', async () => {
      setupDevUser();
      const context = createMockContext();
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = 7200;
      const token = createTestToken(testUsername, expiresIn);
      const useCase = new DevUserSessionUseCase();

      const session = await useCase.lookup(context, token);

      expect(session.expires).toBe(now + expiresIn);
      expect(session.expires).toBeGreaterThan(now);
    });

    test('should cache session and return cached version on subsequent lookups', async () => {
      setupDevUser();
      const context = createMockContext();
      const token = createTestToken(testUsername);
      const useCase = new DevUserSessionUseCase();

      const session1 = await useCase.lookup(context, token);
      expect(session1).toBeDefined();

      const session2 = await useCase.lookup(context, token);
      expect(session2).toBe(session1);
    });

    test('should use token signature as cache key', async () => {
      setupDevUser();
      const context = createMockContext();
      const now = Math.floor(Date.now() / 1000);
      const token1 = createTestToken(testUsername, 3600, now);
      const useCase = new DevUserSessionUseCase();

      const session1 = await useCase.lookup(context, token1);

      const token2 = createTestToken(testUsername, 3600, now + 1);
      const parts1 = token1.split('.');
      const parts2 = token2.split('.');
      expect(parts1[2]).not.toBe(parts2[2]);

      const session2 = await useCase.lookup(context, token2);
      expect(session2).not.toBe(session1);
    });

    test('should include user roles from getUser', async () => {
      setupDevUser();
      const context = createMockContext();
      const token = createTestToken(testUsername);
      const useCase = new DevUserSessionUseCase();

      const session = await useCase.lookup(context, token);

      expect(session.user.roles).toContain(CamsRole.TrialAttorney);
    });

    test('should include user offices from getUser', async () => {
      setupDevUser();
      const context = createMockContext();
      const token = createTestToken(testUsername);
      const useCase = new DevUserSessionUseCase();

      const session = await useCase.lookup(context, token);

      expect(session.user.offices).toHaveLength(1);
      expect(session.user.offices[0].officeCode).toBe('USTP_CAMS_Region_2_Office_Manhattan');
    });

    test('should handle multiple users with different tokens', async () => {
      const user1 = 'user1';
      const user2 = 'user2';

      const devUsers = [
        {
          username: user1,
          passwordHash: MOCK_SCRYPT_HASH,
          name: 'User One',
          roles: ['TrialAttorney'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
        {
          username: user2,
          passwordHash: MOCK_SCRYPT_HASH,
          name: 'User Two',
          roles: ['CaseAssignmentManager'],
          offices: ['USTP_CAMS_Region_3_Office_Philadelphia'],
        },
      ];
      process.env.DEV_USERS = JSON.stringify(devUsers);

      const context = createMockContext();
      const token1 = createTestToken(user1);
      const token2 = createTestToken(user2);
      const useCase = new DevUserSessionUseCase();

      const session1 = await useCase.lookup(context, token1);
      const session2 = await useCase.lookup(context, token2);

      expect(session1.user.name).toBe('User One');
      expect(session2.user.name).toBe('User Two');
      expect(session1.user.id).not.toBe(session2.user.id);
    });

    test('should use provider from context config', async () => {
      setupDevUser();
      const context = createMockContext('dev');
      const token = createTestToken(testUsername);
      const useCase = new DevUserSessionUseCase();

      const session = await useCase.lookup(context, token);

      expect(session.provider).toBe('dev');
    });

    test('should propagate errors from getUser', async () => {
      const context = createMockContext();
      const token = createTestToken('nonexistent-user');
      const useCase = new DevUserSessionUseCase();

      await expect(useCase.lookup(context, token)).rejects.toThrow(
        'DEV_USERS environment variable is not set',
      );
    });

    test('should handle token with no expiration gracefully', async () => {
      setupDevUser();
      const context = createMockContext();

      const claims = {
        aud: 'api://default',
        sub: testUsername,
        iss: 'http://localhost:3000/api/oauth2/default',
        groups: ['TrialAttorney'],
      };
      const token = jwt.sign(claims, 'dev-oauth2-secret');

      const useCase = new DevUserSessionUseCase();
      const session = await useCase.lookup(context, token);

      expect(session).toBeDefined();
      expect(session.expires).toBeUndefined();
    });

    test('should cache sessions independently for different tokens', async () => {
      setupDevUser();
      const context = createMockContext();
      const useCase = new DevUserSessionUseCase();
      const now = Math.floor(Date.now() / 1000);

      const token1 = createTestToken(testUsername, 3600, now);
      const token2 = createTestToken(testUsername, 7200, now + 1);

      const parts1 = token1.split('.');
      const parts2 = token2.split('.');
      expect(parts1[2]).not.toBe(parts2[2]);

      const session1a = await useCase.lookup(context, token1);
      const session2a = await useCase.lookup(context, token2);

      const session1b = await useCase.lookup(context, token1);
      expect(session1b).toBe(session1a);

      const session2b = await useCase.lookup(context, token2);
      expect(session2b).toBe(session2a);

      expect(session1a).not.toBe(session2a);
    });

    test('should include all session fields from CamsSession type', async () => {
      setupDevUser();
      const context = createMockContext();
      const token = createTestToken(testUsername);
      const useCase = new DevUserSessionUseCase();

      const session = await useCase.lookup(context, token);

      expect(session).toHaveProperty('user');
      expect(session).toHaveProperty('accessToken');
      expect(session).toHaveProperty('provider');
      expect(session).toHaveProperty('issuer');
      expect(session).toHaveProperty('expires');
    });
  });
});
