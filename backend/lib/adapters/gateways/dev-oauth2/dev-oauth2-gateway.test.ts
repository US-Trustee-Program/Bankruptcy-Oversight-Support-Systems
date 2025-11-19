import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { ForbiddenError } from '../../../common-errors/forbidden-error';
import { UnauthorizedError } from '../../../common-errors/unauthorized-error';
import { ApplicationContext } from '../../types/basic';
import { CamsRole } from '../../../../../common/src/cams/roles';
import {
  devAuthentication,
  generatePasswordHash,
  verifyToken,
  getUser,
  DevUser,
} from './dev-oauth2-gateway';
import * as dateHelper from '../../../../../common/src/date-helper';

describe('dev-oauth2-oauth2-gateway tests', () => {
  const testPassword = 'testPassword123'; // pragma: allowlist secret
  let testPasswordHash: string;
  const testUsername = 'testuser';

  beforeAll(async () => {
    // Generate a real hash for testing
    testPasswordHash = await generatePasswordHash(testPassword);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.DEV_USERS;
    delete process.env.DEV_SESSION_EXPIRE_LENGTH;
  });

  describe('generatePasswordHash', () => {
    test('should generate hash in correct format', async () => {
      const hash = await generatePasswordHash('password123');
      expect(hash).toMatch(/^scrypt\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
      const parts = hash.split('$');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('scrypt');
      expect(Buffer.from(parts[1], 'base64')).toHaveLength(16); // salt should be 16 bytes
      expect(Buffer.from(parts[2], 'base64')).toHaveLength(64); // hash should be 64 bytes
    });

    test('should generate different hashes for same password', async () => {
      const hash1 = await generatePasswordHash('password');
      const hash2 = await generatePasswordHash('password');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('devAuthentication', () => {
    const mockContext = (provider: string, body: unknown) =>
      ({
        config: {
          authConfig: {
            provider,
          },
        },
        request: {
          body: Promise.resolve(body),
          url: 'http://localhost:3000/api/oauth2/default',
        },
      }) as unknown as ApplicationContext;

    test('should throw ForbiddenError when provider is not dev-oauth2', async () => {
      const context = mockContext('okta', { username: testUsername, password: testPassword });
      await expect(devAuthentication(context)).rejects.toThrow(ForbiddenError);
      await expect(devAuthentication(context)).rejects.toThrow('Not in dev-oauth2 mode...');
    });

    test('should throw error when DEV_USERS is not set', async () => {
      const context = mockContext('dev', { username: testUsername, password: testPassword });
      await expect(devAuthentication(context)).rejects.toThrow(
        'DEV_USERS environment variable is not set',
      );
    });

    test('should throw error when DEV_USERS is not valid JSON', async () => {
      process.env.DEV_USERS = 'invalid json';
      const context = mockContext('dev', { username: testUsername, password: testPassword });
      await expect(devAuthentication(context)).rejects.toThrow('Failed to parse DEV_USERS');
    });

    test('should throw error when DEV_USERS is not an array', async () => {
      process.env.DEV_USERS = '{"username":"test"}';
      const context = mockContext('dev', { username: testUsername, password: testPassword });
      await expect(devAuthentication(context)).rejects.toThrow('DEV_USERS must be a JSON array');
    });

    test('should throw UnauthorizedError when username not found', async () => {
      const devUsers: DevUser[] = [
        {
          username: 'otheruser',
          passwordHash: testPasswordHash,
          roles: ['TrialAttorney'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      process.env.DEV_USERS = JSON.stringify(devUsers);
      const context = mockContext('dev', { username: testUsername, password: testPassword });
      await expect(devAuthentication(context)).rejects.toThrow(UnauthorizedError);
      await expect(devAuthentication(context)).rejects.toThrow('Invalid username or password');
    });

    test('should throw UnauthorizedError when password is incorrect', async () => {
      const devUsers: DevUser[] = [
        {
          username: testUsername,
          passwordHash: testPasswordHash,
          roles: ['TrialAttorney'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      process.env.DEV_USERS = JSON.stringify(devUsers);
      const context = mockContext('dev', { username: testUsername, password: 'wrongPassword' });
      await expect(devAuthentication(context)).rejects.toThrow(UnauthorizedError);
      await expect(devAuthentication(context)).rejects.toThrow('Invalid username or password');
    });

    test('should return valid JWT token for correct credentials', async () => {
      const devUsers: DevUser[] = [
        {
          username: testUsername,
          passwordHash: testPasswordHash,
          name: 'Test User',
          roles: ['TrialAttorney', 'PrivilegedIdentityUser'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      process.env.DEV_USERS = JSON.stringify(devUsers);
      const context = mockContext('dev', { username: testUsername, password: testPassword });

      const token = await devAuthentication(context);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.decode(token) as jwt.JwtPayload;
      expect(decoded.aud).toBe('api://default');
      expect(decoded.iss).toBe('http://localhost:3000/api/oauth2/default');
      expect(decoded.sub).toBe(crypto.createHash('sha256').update(testUsername).digest('hex'));
      expect(decoded.groups).toEqual(['TrialAttorney', 'PrivilegedIdentityUser']);
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
    });

    test('should use default expiration when DEV_SESSION_EXPIRE_LENGTH is not a number', async () => {
      process.env.DEV_SESSION_EXPIRE_LENGTH = 'not-a-number';
      const devUsers: DevUser[] = [
        {
          username: testUsername,
          passwordHash: testPasswordHash,
          roles: ['TrialAttorney'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      process.env.DEV_USERS = JSON.stringify(devUsers);

      const now = 1234567890;
      jest.spyOn(dateHelper, 'nowInSeconds').mockReturnValue(now);

      const context = mockContext('dev', { username: testUsername, password: testPassword });
      const token = await devAuthentication(context);

      const decoded = jwt.decode(token) as jwt.JwtPayload;
      const ONE_DAY = 60 * 60 * 24;
      expect(decoded.exp).toBe(now + ONE_DAY);
    });
  });

  describe('verifyToken', () => {
    test('should verify and decode a valid token', async () => {
      const claims = {
        aud: 'api://default',
        sub: 'test-sub',
        iss: 'test-issuer',
        exp: Math.floor(Date.now() / 1000) + 3600,
        groups: ['group1', 'group2'],
      };
      const token = jwt.sign(claims, 'dev-oauth2-secret');

      const result = await verifyToken(token);

      expect(result.claims.aud).toBe(claims.aud);
      expect(result.claims.sub).toBe(claims.sub);
      expect(result.claims.iss).toBe(claims.iss);
      expect(result.claims.exp).toBe(claims.exp);
      expect(result.claims.groups).toEqual(claims.groups);
      expect(result.header).toBeDefined();
      expect(result.header.typ).toBe('');
    });

    test('should throw error for invalid token', async () => {
      const invalidToken = 'invalid.token.here';
      await expect(verifyToken(invalidToken)).rejects.toThrow();
    });

    test('should throw error for token with wrong signature', async () => {
      const claims = {
        aud: 'api://default',
        sub: 'test-sub',
        iss: 'test-issuer',
        exp: Math.floor(Date.now() / 1000) + 3600,
        groups: ['group1'],
      };
      const token = jwt.sign(claims, 'wrong-secret');
      await expect(verifyToken(token)).rejects.toThrow();
    });
  });

  describe('getUser', () => {
    const createToken = (username: string) => {
      const sub = crypto.createHash('sha256').update(username).digest('hex');
      const claims = {
        aud: 'api://default',
        sub,
        iss: 'test-issuer',
        exp: Math.floor(Date.now() / 1000) + 3600,
        groups: ['TrialAttorney', 'PrivilegedIdentityUser'],
      };
      return jwt.sign(claims, 'dev-oauth2-secret');
    };

    test('should retrieve user from valid token', async () => {
      const devUsers: DevUser[] = [
        {
          username: testUsername,
          passwordHash: testPasswordHash,
          name: 'Test User',
          roles: ['TrialAttorney', 'PrivilegedIdentityUser'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      process.env.DEV_USERS = JSON.stringify(devUsers);

      const token = createToken(testUsername);
      const result = await getUser(token);

      expect(result.user).toBeDefined();
      expect(result.user.name).toBe('Test User');
      expect(result.user.id).toBe(crypto.createHash('sha256').update(testUsername).digest('hex'));
      expect(result.user.roles).toContain(CamsRole.TrialAttorney);
      expect(result.user.roles).toContain(CamsRole.PrivilegedIdentityUser);
      expect(result.user.offices).toHaveLength(1);
      expect(result.user.offices[0].officeCode).toBe('USTP_CAMS_Region_2_Office_Manhattan');
      expect(result.groups).toEqual(['TrialAttorney', 'PrivilegedIdentityUser']);
    });

    test('should use username as name when name is not provided', async () => {
      const devUsers: DevUser[] = [
        {
          username: testUsername,
          passwordHash: testPasswordHash,
          roles: ['TrialAttorney'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      process.env.DEV_USERS = JSON.stringify(devUsers);

      const token = createToken(testUsername);
      const result = await getUser(token);

      expect(result.user.name).toBe(testUsername);
    });

    test('should throw UnauthorizedError when user not found in DEV_USERS', async () => {
      const devUsers: DevUser[] = [
        {
          username: 'otheruser',
          passwordHash: testPasswordHash,
          roles: ['TrialAttorney'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      process.env.DEV_USERS = JSON.stringify(devUsers);

      const token = createToken(testUsername);
      await expect(getUser(token)).rejects.toThrow(UnauthorizedError);
      await expect(getUser(token)).rejects.toThrow('User not found');
    });

    test('should filter out invalid roles', async () => {
      const devUsers: DevUser[] = [
        {
          username: testUsername,
          passwordHash: testPasswordHash,
          roles: ['TrialAttorney', 'InvalidRole', 'PrivilegedIdentityUser'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      process.env.DEV_USERS = JSON.stringify(devUsers);

      const token = createToken(testUsername);
      const result = await getUser(token);

      expect(result.user.roles).toHaveLength(2);
      expect(result.user.roles).toContain(CamsRole.TrialAttorney);
      expect(result.user.roles).toContain(CamsRole.PrivilegedIdentityUser);
      expect(result.user.roles).not.toContain('InvalidRole' as CamsRole);
    });

    test('should filter out invalid office codes', async () => {
      const devUsers: DevUser[] = [
        {
          username: testUsername,
          passwordHash: testPasswordHash,
          roles: ['TrialAttorney'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan', 'InvalidOfficeCode'],
        },
      ];
      process.env.DEV_USERS = JSON.stringify(devUsers);

      const token = createToken(testUsername);
      const result = await getUser(token);

      expect(result.user.offices).toHaveLength(1);
      expect(result.user.offices[0].officeCode).toBe('USTP_CAMS_Region_2_Office_Manhattan');
    });

    test('should handle empty groups in token', async () => {
      const devUsers: DevUser[] = [
        {
          username: testUsername,
          passwordHash: testPasswordHash,
          roles: ['TrialAttorney'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      process.env.DEV_USERS = JSON.stringify(devUsers);

      const sub = crypto.createHash('sha256').update(testUsername).digest('hex');
      const claims = {
        aud: 'api://default',
        sub,
        iss: 'test-issuer',
        exp: Math.floor(Date.now() / 1000) + 3600,
        // groups is omitted
      };
      const token = jwt.sign(claims, 'dev-oauth2-secret');

      const result = await getUser(token);
      expect(result.groups).toEqual([]);
    });
  });

  describe('password verification edge cases', () => {
    test('should reject password with invalid hash format - missing parts', async () => {
      const devUsers: DevUser[] = [
        {
          username: testUsername,
          passwordHash: 'invalid$hash', // pragma: allowlist secret
          roles: ['TrialAttorney'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      process.env.DEV_USERS = JSON.stringify(devUsers);

      const context = {
        config: { authConfig: { provider: 'dev' } },
        request: {
          body: Promise.resolve({ username: testUsername, password: testPassword }),
          url: 'http://localhost:3000/api/oauth2/default',
        },
      } as unknown as ApplicationContext;

      await expect(devAuthentication(context)).rejects.toThrow('Password verification failed');
    });

    test('should reject password with invalid hash format - wrong algorithm', async () => {
      const devUsers: DevUser[] = [
        {
          username: testUsername,
          passwordHash: 'bcrypt$salt$hash', // pragma: allowlist secret
          roles: ['TrialAttorney'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      process.env.DEV_USERS = JSON.stringify(devUsers);

      const context = {
        config: { authConfig: { provider: 'dev' } },
        request: {
          body: Promise.resolve({ username: testUsername, password: testPassword }),
          url: 'http://localhost:3000/api/oauth2/default',
        },
      } as unknown as ApplicationContext;

      await expect(devAuthentication(context)).rejects.toThrow('Password verification failed');
    });
  });
});
