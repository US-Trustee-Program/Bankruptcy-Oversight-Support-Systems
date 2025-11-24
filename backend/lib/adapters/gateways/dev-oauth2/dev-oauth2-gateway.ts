import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { ApplicationContext } from '../../types/basic';
import { ForbiddenError } from '../../../common-errors/forbidden-error';
import { UnauthorizedError } from '../../../common-errors/unauthorized-error';
import { CamsUser } from '../../../../../common/src/cams/users';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { CamsJwt, CamsJwtClaims, CamsJwtHeader } from '../../../../../common/src/cams/jwt';
import { OpenIdConnectGateway } from '../../types/authorization';
import {
  UstpOfficeDetails,
  MOCKED_USTP_OFFICE_DATA_MAP,
} from '../../../../../common/src/cams/offices';
import { nowInSeconds } from '../../../../../common/src/date-helper';
import { DevUsersMongoRepository } from '../mongo/dev-users.mongo.repository';

const MODULE_NAME = 'DEV-OAUTH2-GATEWAY';
const key = 'dev-oauth2-secret'; //pragma: allowlist secret

const EXPIRE_OVERRIDE = parseInt(process.env.DEV_SESSION_EXPIRE_LENGTH);

const scrypt = promisify(crypto.scrypt);

export type DevUser = {
  username: string;
  passwordHash: string; // Format: "scrypt$salt$hash" where salt and hash are base64 encoded
  name?: string;
  roles: string[];
  offices: string[];
};

async function loadDevUsersFromMongo(context: ApplicationContext): Promise<DevUser[]> {
  const { logger } = context;
  const connectionString = context.config.documentDbConfig.connectionString;
  if (!connectionString) {
    logger.error(
      MODULE_NAME,
      'MONGO_CONNECTION_STRING not configured. Cannot load users from MongoDB.',
    );
    return [];
  }

  let repo: DevUsersMongoRepository | null = null;
  try {
    repo = DevUsersMongoRepository.getInstance(context);
    const users = await repo.getAllUsers(context);
    return users;
  } catch (error) {
    logger.error(
      MODULE_NAME,
      `Failed to load users from MongoDB: ${error.message}. Using empty user database.`,
    );
    return [];
  } finally {
    if (repo) {
      repo.release();
    }
  }
}

export async function loadDevUsers(context: ApplicationContext): Promise<DevUser[]> {
  const { logger } = context;
  // Try multiple possible paths to find dev-users.json
  // Different paths are needed for:
  // 1. tsx execution (local express): backend/lib/adapters/gateways/dev-oauth2/ -> 4 levels up
  // 2. Compiled function app (local): backend/function-apps/api/dist/backend/lib/adapters/gateways/dev-oauth2/ -> 6 levels up
  // 3. Deployed: /home/site/wwwroot/dist/backend/lib/adapters/gateways/dev-oauth2/ -> 6 levels up
  const possiblePaths = [
    path.resolve(__dirname, '../../../../dev-users.json'), // For tsx execution
    path.resolve(__dirname, '../../../../../dev-users.json'), // For compiled code
  ];

  let devUsersPath: string | null = null;
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      devUsersPath = testPath;
      break;
    }
  }

  if (!devUsersPath) {
    logger.warn(
      MODULE_NAME,
      `dev-users.json file not found. Tried: ${possiblePaths.join(', ')}. Attempting to load from MongoDB.`,
    );
    return await loadDevUsersFromMongo(context);
  }

  try {
    const fileContent = fs.readFileSync(devUsersPath, 'utf-8');
    const users = JSON.parse(fileContent);
    if (!Array.isArray(users)) {
      logger.error(
        MODULE_NAME,
        'dev-users.json must contain a JSON array. Attempting to load from MongoDB.',
      );
      return await loadDevUsersFromMongo(context);
    }
    logger.info(MODULE_NAME, `Loaded ${users.length} users from dev-users.json file.`);
    return users as DevUser[];
  } catch (error) {
    logger.error(
      MODULE_NAME,
      `Failed to parse dev-users.json: ${error.message}. Attempting to load from MongoDB.`,
    );
    return await loadDevUsersFromMongo(context);
  }
}

/**
 * Hashes a username to create a user ID for database persistence.
 * Uses SHA-256 to create a consistent, non-reversible identifier.
 */
function hashUsername(username: string): string {
  return crypto.createHash('sha256').update(username).digest('hex');
}

/**
 * Verifies a password against a stored hash.
 * Hash format: "scrypt$salt$hash" where salt and hash are base64 encoded
 */
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      throw new Error('Invalid hash format. Expected: scrypt$salt$hash');
    }

    const salt = Buffer.from(parts[1], 'base64');
    const storedHashBuffer = Buffer.from(parts[2], 'base64');

    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;

    return crypto.timingSafeEqual(derivedKey, storedHashBuffer);
  } catch (error) {
    throw new Error(`Password verification failed: ${error.message}`);
  }
}

/**
 * Generates a password hash for storing in dev-users.json file.
 * This is a utility function - the actual hash should be generated offline.
 */
export async function generatePasswordHash(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString('base64')}$${derivedKey.toString('base64')}`;
}

export async function devAuthentication(context: ApplicationContext): Promise<string> {
  if (context.config.authConfig.provider !== 'dev') {
    throw new ForbiddenError(MODULE_NAME, { message: 'Not in dev-oauth2 mode...' });
  }

  const credentials = (await context.request.body) as { username: string; password: string };
  const devUsers = await loadDevUsers(context);

  const devUser = devUsers.find((u) => u.username === credentials.username);

  if (!devUser) {
    throw new UnauthorizedError(MODULE_NAME, { message: 'Invalid username or password' });
  }

  const isPasswordValid = await verifyPassword(credentials.password, devUser.passwordHash);

  if (!isPasswordValid) {
    throw new UnauthorizedError(MODULE_NAME, { message: 'Invalid username or password' });
  }

  const ONE_DAY = 60 * 60 * 24;
  const NOW = nowInSeconds();
  const expiration = isNaN(EXPIRE_OVERRIDE) ? NOW + ONE_DAY : NOW + EXPIRE_OVERRIDE;

  const sub = devUser.username;

  // Map role names to groups for JWT
  const groups = devUser.roles || [];

  const claims: CamsJwtClaims = {
    aud: 'api://default',
    sub,
    iss: context.request.url,
    exp: expiration,
    groups,
  };

  const token = jwt.sign(claims, key);
  return token;
}

export async function verifyToken(accessToken: string): Promise<CamsJwt> {
  const payload = jwt.verify(accessToken, key) as jwt.JwtPayload;
  const claims: CamsJwtClaims = {
    iss: payload.iss!,
    sub: payload.sub!,
    aud: payload.aud!,
    exp: payload.exp!,
    groups: payload.groups!,
    ...payload,
  };

  const header: CamsJwtHeader = { typ: '' };
  const camsJwt: CamsJwt = {
    claims,
    header,
  };
  return camsJwt;
}

export async function getUser(context: ApplicationContext, accessToken: string) {
  const decodedToken = jwt.decode(accessToken) as jwt.JwtPayload;
  const devUsers = await loadDevUsers(context);

  // Find user by username in sub claim
  const devUser = devUsers.find((u) => u.username === decodedToken.sub);

  if (!devUser) {
    throw new UnauthorizedError(MODULE_NAME, { message: 'User not found' });
  }

  // Map role strings to CamsRole enum values
  const roles: CamsRole[] = devUser.roles
    .map((roleName) => {
      // Try to find matching CamsRole
      const roleKey = Object.keys(CamsRole).find(
        (key) => CamsRole[key as keyof typeof CamsRole] === roleName,
      );
      return roleKey ? CamsRole[roleKey as keyof typeof CamsRole] : null;
    })
    .filter((role): role is CamsRole => role !== null);

  // Map office strings to UstpOfficeDetails objects
  // Office codes should match keys in MOCKED_USTP_OFFICE_DATA_MAP
  const offices: UstpOfficeDetails[] = devUser.offices
    .map((officeCode) => MOCKED_USTP_OFFICE_DATA_MAP.get(officeCode))
    .filter((office): office is UstpOfficeDetails => office !== undefined);

  const user: CamsUser = {
    id: hashUsername(decodedToken.sub),
    name: devUser.name || devUser.username,
    roles,
    offices,
  };

  const verifiedJwt = await verifyToken(accessToken);

  return { user, groups: decodedToken.groups || [], jwt: verifiedJwt };
}

const DevOpenIdConnectGateway: OpenIdConnectGateway = {
  getUser,
};

export default DevOpenIdConnectGateway;
