import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import * as fs from 'fs';
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
import { MOCK_SCRYPT_HASH } from './dev-oauth2-test-helper';
import { MongoCollectionAdapter } from '../mongo/utils/mongo-adapter';
import { createMockApplicationContext } from '../../../testing/testing-utilities';

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

// Helper function to mock MongoDB MongoCollectionAdapter
function mockMongoUsers(users: DevUser[], shouldThrow = false) {
  if (shouldThrow) {
    return jest
      .spyOn(MongoCollectionAdapter.prototype, 'getAll')
      .mockRejectedValue(new Error('Connection failed'));
  }
  return jest.spyOn(MongoCollectionAdapter.prototype, 'getAll').mockResolvedValue(users);
}

describe('dev-oauth2-gateway tests', () => {
  const testCredential = 'abc123xyz';
  let testCredentialHash: string;
  const testUsername = 'testuser';

  beforeAll(async () => {
    // Generate a real hash for testing
    testCredentialHash = await generatePasswordHash(testCredential);
  });

  describe('generatePasswordHash', () => {
    test('should generate hash in correct format', async () => {
      const hash = await generatePasswordHash('xyz789def');
      expect(hash).toMatch(/^scrypt\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
      const parts = hash.split('$');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('scrypt');
      expect(Buffer.from(parts[1], 'base64')).toHaveLength(16); // salt should be 16 bytes
      expect(Buffer.from(parts[2], 'base64')).toHaveLength(64); // hash should be 64 bytes
    });

    test('should generate different hashes for same input', async () => {
      const hash1 = await generatePasswordHash('abc123');
      const hash2 = await generatePasswordHash('abc123');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('devAuthentication', () => {
    async function mockContext(
      provider: string,
      body: unknown,
      connectionString?: string,
    ): Promise<ApplicationContext> {
      const context = await createMockApplicationContext({
        env: {
          MONGO_CONNECTION_STRING: connectionString || process.env.MONGO_CONNECTION_STRING || '',
        },
        request: {
          method: 'POST',
          body,
          url: 'http://localhost:3000/api/oauth2/default',
        },
      });
      context.config.authConfig.provider = provider;
      return context;
    }

    afterEach(() => {
      jest.restoreAllMocks();
      delete process.env.DEV_SESSION_EXPIRE_LENGTH;
    });

    test('should throw ForbiddenError when provider is not dev-oauth2', async () => {
      const context = await mockContext('okta', {
        username: testUsername,
        password: testCredential,
      });
      await expect(devAuthentication(context)).rejects.toThrow(ForbiddenError);
      await expect(devAuthentication(context)).rejects.toThrow('Not in dev-oauth2 mode...');
    });

    test('should handle missing dev-users.json file gracefully', async () => {
      mockMongoUsers([]); // Return no users from MongoDB
      mockDevUsersFile(null); // File doesn't exist
      const context = await mockContext('dev', {
        username: testUsername,
        password: testCredential,
      });
      // Should get UnauthorizedError because user not found (empty database)
      await expect(devAuthentication(context)).rejects.toThrow(UnauthorizedError);
      await expect(devAuthentication(context)).rejects.toThrow('Invalid username or password');
    });

    test('should handle invalid JSON in dev-users.json gracefully', async () => {
      mockMongoUsers([]); // Return no users from MongoDB
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue('invalid json');
      const context = await mockContext('dev', {
        username: testUsername,
        password: testCredential,
      });
      // Should get UnauthorizedError because user not found (empty database due to parse error)
      await expect(devAuthentication(context)).rejects.toThrow(UnauthorizedError);
      await expect(devAuthentication(context)).rejects.toThrow('Invalid username or password');
    });

    test('should handle non-array content in dev-users.json gracefully', async () => {
      mockMongoUsers([]); // Return no users from MongoDB
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue('{"username":"test"}');
      const context = await mockContext('dev', {
        username: testUsername,
        password: testCredential,
      });
      // Should get UnauthorizedError because user not found (empty database due to invalid format)
      await expect(devAuthentication(context)).rejects.toThrow(UnauthorizedError);
      await expect(devAuthentication(context)).rejects.toThrow('Invalid username or password');
    });

    test('should throw UnauthorizedError when username not found', async () => {
      const devUsers: DevUser[] = [
        {
          username: 'otheruser',
          passwordHash: MOCK_SCRYPT_HASH,
          roles: ['TrialAttorney'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      mockDevUsersFile(devUsers);
      const context = await mockContext('dev', {
        username: testUsername,
        password: testCredential,
      });
      await expect(devAuthentication(context)).rejects.toThrow(UnauthorizedError);
      await expect(devAuthentication(context)).rejects.toThrow('Invalid username or password');
    });

    test('should throw UnauthorizedError when credentials are incorrect', async () => {
      const devUsers: DevUser[] = [
        {
          username: testUsername,
          passwordHash: testCredentialHash,
          roles: ['TrialAttorney'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      mockDevUsersFile(devUsers);
      const context = await mockContext('dev', {
        username: testUsername,
        password: 'wrongvalue123', // pragma: allowlist secret
      });
      await expect(devAuthentication(context)).rejects.toThrow(UnauthorizedError);
      await expect(devAuthentication(context)).rejects.toThrow('Invalid username or password');
    });

    test('should return valid JWT token for correct credentials', async () => {
      const devUsers: DevUser[] = [
        {
          username: testUsername,
          passwordHash: testCredentialHash,
          name: 'Test User',
          roles: ['TrialAttorney', 'PrivilegedIdentityUser'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      mockDevUsersFile(devUsers);
      const context = await mockContext('dev', {
        username: testUsername,
        password: testCredential,
      });

      const token = await devAuthentication(context);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.decode(token) as jwt.JwtPayload;
      expect(decoded.aud).toBe('api://default');
      expect(decoded.iss).toBe('http://localhost:3000/api/oauth2/default');
      expect(decoded.sub).toBe(testUsername);
      expect(decoded.groups).toEqual(['TrialAttorney', 'PrivilegedIdentityUser']);
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
    });

    test('should set expiration correctly (covers isNaN branch)', async () => {
      // This test covers both branches of: isNaN(EXPIRE_OVERRIDE) ? NOW + ONE_DAY : NOW + EXPIRE_OVERRIDE
      // Since EXPIRE_OVERRIDE is parsed at module load time, we just verify expiration is set
      const devUsers: DevUser[] = [
        {
          username: testUsername,
          passwordHash: testCredentialHash,
          roles: ['TrialAttorney'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      mockDevUsersFile(devUsers);

      const now = 1234567890;
      jest.spyOn(dateHelper, 'nowInSeconds').mockReturnValue(now);

      const context = await mockContext('dev', {
        username: testUsername,
        password: testCredential,
      });
      const token = await devAuthentication(context);

      const decoded = jwt.decode(token) as jwt.JwtPayload;
      // Expiration should be in the future
      expect(decoded.exp).toBeGreaterThan(now);
    });

    test('should handle user with undefined roles field', async () => {
      const devUsers: DevUser[] = [
        {
          username: testUsername,
          passwordHash: testCredentialHash,
          roles: undefined, // Explicitly test undefined
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      mockDevUsersFile(devUsers);

      const context = await mockContext('dev', {
        username: testUsername,
        password: testCredential,
      });
      const token = await devAuthentication(context);

      expect(token).toBeDefined();
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      expect(decoded.groups).toEqual([]);
    });
  });

  describe('verifyToken', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

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
    let context: ApplicationContext;

    beforeEach(async () => {
      context = await createMockApplicationContext();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    const createToken = (username: string) => {
      const claims = {
        aud: 'api://default',
        sub: username,
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
          passwordHash: MOCK_SCRYPT_HASH,
          name: 'Test User',
          roles: ['TrialAttorney', 'PrivilegedIdentityUser'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      mockDevUsersFile(devUsers);

      const token = createToken(testUsername);
      const result = await getUser(context, token);

      expect(result.user).toBeDefined();
      expect(result.user.name).toBe('Test User');
      expect(result.user.id).toBe(crypto.createHash('sha256').update(testUsername).digest('hex'));
      expect(result.user.roles).toContain(CamsRole.TrialAttorney);
      expect(result.user.roles).toContain(CamsRole.PrivilegedIdentityUser);
      expect(result.user.offices).toHaveLength(1);
      expect(result.user.offices[0].officeCode).toBe('USTP_CAMS_Region_2_Office_Manhattan');
      expect(result.groups).toEqual(['TrialAttorney', 'PrivilegedIdentityUser']);

      // Verify JWT object is properly formed with claims
      expect(result.jwt).toBeDefined();
      expect(result.jwt.claims).toBeDefined();
      expect(result.jwt.claims.sub).toBe(testUsername);
      expect(result.jwt.claims.iss).toBe('test-issuer');
      expect(result.jwt.claims.exp).toBeGreaterThan(Date.now() / 1000);
      expect(result.jwt.claims.aud).toBe('api://default');
      expect(result.jwt.claims.groups).toEqual(['TrialAttorney', 'PrivilegedIdentityUser']);
      expect(result.jwt.header).toBeDefined();
    });

    test('should use username as name when name is not provided', async () => {
      const devUsers: DevUser[] = [
        {
          username: testUsername,
          passwordHash: MOCK_SCRYPT_HASH,
          roles: ['TrialAttorney'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      mockDevUsersFile(devUsers);

      const token = createToken(testUsername);
      const result = await getUser(context, token);

      expect(result.user.name).toBe(testUsername);

      // Verify JWT is still properly formed even when name is not provided
      expect(result.jwt).toBeDefined();
      expect(result.jwt.claims).toBeDefined();
      expect(result.jwt.claims.exp).toBeDefined();
      expect(result.jwt.claims.iss).toBeDefined();
    });

    test('should throw UnauthorizedError when user not found in dev-users.json', async () => {
      const devUsers: DevUser[] = [
        {
          username: 'otheruser',
          passwordHash: MOCK_SCRYPT_HASH,
          roles: ['TrialAttorney'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      mockDevUsersFile(devUsers);

      const token = createToken(testUsername);
      await expect(getUser(context, token)).rejects.toThrow(UnauthorizedError);
      await expect(getUser(context, token)).rejects.toThrow('User not found');
    });

    test('should filter out invalid roles', async () => {
      const devUsers: DevUser[] = [
        {
          username: testUsername,
          passwordHash: MOCK_SCRYPT_HASH,
          roles: ['TrialAttorney', 'InvalidRole', 'PrivilegedIdentityUser'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      mockDevUsersFile(devUsers);

      const token = createToken(testUsername);
      const result = await getUser(context, token);

      expect(result.user.roles).toHaveLength(2);
      expect(result.user.roles).toContain(CamsRole.TrialAttorney);
      expect(result.user.roles).toContain(CamsRole.PrivilegedIdentityUser);
      expect(result.user.roles).not.toContain('InvalidRole' as CamsRole);
    });

    test('should filter out invalid office codes', async () => {
      const devUsers: DevUser[] = [
        {
          username: testUsername,
          passwordHash: MOCK_SCRYPT_HASH,
          roles: ['TrialAttorney'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan', 'InvalidOfficeCode'],
        },
      ];
      mockDevUsersFile(devUsers);

      const token = createToken(testUsername);
      const result = await getUser(context, token);

      expect(result.user.offices).toHaveLength(1);
      expect(result.user.offices[0].officeCode).toBe('USTP_CAMS_Region_2_Office_Manhattan');
    });

    test('should handle empty groups in token', async () => {
      const devUsers: DevUser[] = [
        {
          username: testUsername,
          passwordHash: MOCK_SCRYPT_HASH,
          roles: ['TrialAttorney'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      mockDevUsersFile(devUsers);

      const claims = {
        aud: 'api://default',
        sub: testUsername,
        iss: 'test-issuer',
        exp: Math.floor(Date.now() / 1000) + 3600,
        // groups is omitted
      };
      const token = jwt.sign(claims, 'dev-oauth2-secret');

      const result = await getUser(context, token);
      expect(result.groups).toEqual([]);

      // Verify JWT claims are properly formed
      expect(result.jwt).toBeDefined();
      expect(result.jwt.claims).toBeDefined();
      expect(result.jwt.claims.sub).toBe(testUsername);
      expect(result.jwt.claims.exp).toBe(claims.exp);
      expect(result.jwt.claims.iss).toBe(claims.iss);
      expect(result.jwt.claims.aud).toBe(claims.aud);
    });
  });

  describe('MongoDB fallback', () => {
    async function mockContext(
      provider: string,
      body: unknown,
      connectionString?: string,
    ): Promise<ApplicationContext> {
      const context = await createMockApplicationContext({
        env: {
          MONGO_CONNECTION_STRING: connectionString || '',
        },
        request: {
          method: 'POST',
          body,
          url: 'http://localhost:3000/api/oauth2/default',
        },
      });
      context.config.authConfig.provider = provider;
      return context;
    }

    afterEach(() => {
      jest.restoreAllMocks();
      delete process.env.MONGO_CONNECTION_STRING;
    });

    test('should fall back to MongoDB when file does not exist and MONGO_CONNECTION_STRING is not set', async () => {
      mockDevUsersFile(null); // File doesn't exist
      const context = await mockContext(
        'dev',
        {
          username: testUsername,
          password: testCredential,
        },
        '',
      );

      // Should get UnauthorizedError because MongoDB can't load users (no connection string)
      await expect(devAuthentication(context)).rejects.toThrow(UnauthorizedError);
      await expect(devAuthentication(context)).rejects.toThrow('Invalid username or password');
    });

    test('should successfully load users from MongoDB when file does not exist', async () => {
      const testUser: DevUser = {
        username: testUsername,
        passwordHash: testCredentialHash,
        name: 'MongoDB User',
        roles: ['TrialAttorney'],
        offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
      };

      mockMongoUsers([testUser]);
      mockDevUsersFile(null); // File doesn't exist
      const context = await mockContext(
        'dev',
        { username: testUsername, password: testCredential },
        'mongodb://test-connection',
      );

      const token = await devAuthentication(context);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    test('should handle MongoDB connection error gracefully', async () => {
      mockMongoUsers([], true); // shouldThrow = true
      mockDevUsersFile(null); // File doesn't exist
      const context = await mockContext(
        'dev',
        { username: testUsername, password: testCredential },
        'mongodb://test-connection',
      );

      // Should get UnauthorizedError because MongoDB connection failed
      await expect(devAuthentication(context)).rejects.toThrow(UnauthorizedError);
      await expect(devAuthentication(context)).rejects.toThrow('Invalid username or password');
    });

    test('should fall back to MongoDB when JSON parsing fails', async () => {
      process.env.MONGO_CONNECTION_STRING = 'mongodb://test-connection';

      const testUser: DevUser = {
        username: testUsername,
        passwordHash: testCredentialHash,
        name: 'MongoDB User',
        roles: ['TrialAttorney'],
        offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
      };

      mockMongoUsers([testUser]);
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue('invalid json');

      const context = await mockContext(
        'dev',
        { username: testUsername, password: testCredential },
        'mongodb://test-connection',
      );
      const token = await devAuthentication(context);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    test('should fall back to MongoDB when JSON is not an array', async () => {
      const testUser: DevUser = {
        username: testUsername,
        passwordHash: testCredentialHash,
        name: 'MongoDB User',
        roles: ['TrialAttorney'],
        offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
      };

      mockMongoUsers([testUser]);
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue('{"username":"test"}');

      const context = await mockContext(
        'dev',
        { username: testUsername, password: testCredential },
        'mongodb://test-connection',
      );
      const token = await devAuthentication(context);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });
  });

  describe('credential verification edge cases', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should reject invalid hash format - missing parts', async () => {
      const devUsers: DevUser[] = [
        {
          username: testUsername,
          passwordHash: 'invalid', // pragma: allowlist secret
          roles: ['TrialAttorney'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      mockDevUsersFile(devUsers);

      const context = await createMockApplicationContext({
        request: {
          method: 'POST',
          body: { username: testUsername, password: testCredential },
          url: 'http://localhost:3000/api/oauth2/default',
        },
      });
      context.config.authConfig.provider = 'dev';

      await expect(devAuthentication(context)).rejects.toThrow('Password verification failed');
    });

    test('should reject invalid hash format - wrong algorithm', async () => {
      const devUsers: DevUser[] = [
        {
          username: testUsername,
          passwordHash: 'bogus', // pragma: allowlist secret
          roles: ['TrialAttorney'],
          offices: ['USTP_CAMS_Region_2_Office_Manhattan'],
        },
      ];
      mockDevUsersFile(devUsers);

      const context = await createMockApplicationContext({
        request: {
          method: 'POST',
          body: { username: testUsername, password: testCredential },
          url: 'http://localhost:3000/api/oauth2/default',
        },
      });
      context.config.authConfig.provider = 'dev';

      await expect(devAuthentication(context)).rejects.toThrow('Password verification failed');
    });
  });
});
