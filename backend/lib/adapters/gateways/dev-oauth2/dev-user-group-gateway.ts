import { randomUUID } from 'crypto';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { CamsUser, CamsUserGroup, CamsUserReference } from '../../../../../common/src/cams/users';
import LocalStorageGateway from '../storage/local-storage-gateway';
import { UserGroupGateway, UserGroupGatewayConfig } from '../../types/authorization';
import { ApplicationContext } from '../../types/basic';
import {
  MOCKED_USTP_OFFICES_ARRAY,
  MOCKED_USTP_OFFICE_DATA_MAP,
} from '../../../../../common/src/cams/offices';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { getCamsUserReference } from '../../../../../common/src/cams/session';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { DevUser } from './dev-oauth2-gateway';
import { DevUsersMongoRepository } from '../mongo/dev-users.mongo.repository';

const MODULE_NAME = 'DEV-USER-GROUP-GATEWAY';

async function loadDevUsersFromMongo(context: ApplicationContext): Promise<DevUser[]> {
  const connectionString = context.config.documentDbConfig.connectionString;
  if (!connectionString) {
    console.error(
      `${MODULE_NAME}: MONGO_CONNECTION_STRING not configured. Cannot load users from MongoDB.`,
    );
    return [];
  }

  let repo: DevUsersMongoRepository | null = null;
  try {
    repo = DevUsersMongoRepository.getInstance(context);
    const users = await repo.getAllUsers();
    return users;
  } catch (error) {
    console.error(
      `${MODULE_NAME}: Failed to load users from MongoDB: ${error.message}. Using empty user database.`,
    );
    return [];
  } finally {
    if (repo) {
      repo.release();
    }
  }
}

async function loadDevUsers(context: ApplicationContext): Promise<DevUser[]> {
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
    console.warn(
      `${MODULE_NAME}: dev-users.json file not found. Tried: ${possiblePaths.join(', ')}. Attempting to load from MongoDB.`,
    );
    return await loadDevUsersFromMongo(context);
  }

  try {
    const fileContent = fs.readFileSync(devUsersPath, 'utf-8');
    const users = JSON.parse(fileContent);
    if (!Array.isArray(users)) {
      console.error(
        `${MODULE_NAME}: dev-users.json must contain a JSON array. Attempting to load from MongoDB.`,
      );
      return await loadDevUsersFromMongo(context);
    }
    console.log(`${MODULE_NAME}: Loaded ${users.length} users from dev-users.json file.`);
    return users as DevUser[];
  } catch (error) {
    console.error(
      `${MODULE_NAME}: Failed to parse dev-users.json: ${error.message}. Attempting to load from MongoDB.`,
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

function devUserToCamsUser(devUser: DevUser): CamsUser {
  const roles: CamsRole[] = devUser.roles
    .map((roleName) => {
      const roleKey = Object.keys(CamsRole).find(
        (key) => CamsRole[key as keyof typeof CamsRole] === roleName,
      );
      return roleKey ? CamsRole[roleKey as keyof typeof CamsRole] : null;
    })
    .filter((role): role is CamsRole => role !== null);

  const offices = devUser.offices
    .map((officeCode) => MOCKED_USTP_OFFICE_DATA_MAP.get(officeCode))
    .filter((office) => office !== undefined);

  return {
    id: hashUsername(devUser.username),
    name: devUser.name || devUser.username,
    roles,
    offices,
  };
}

const camsUserGroups = new Map<string, CamsUserGroup>();

async function initializeGroups(context: ApplicationContext) {
  if (camsUserGroups.size > 0) return;

  const devUsers = await loadDevUsers(context);
  const camsUsers = devUsers.map(devUserToCamsUser);

  // Add the roles.
  LocalStorageGateway.getRoleMapping().forEach((camsRole, groupName) => {
    const group: CamsUserGroup = {
      id: randomUUID(),
      name: groupName,
    };

    group.users = camsUsers
      .filter((user) => user.roles.includes(camsRole))
      .map((user) => getCamsUserReference(user));

    camsUserGroups.set(groupName, group);
  });

  // Add the locations.
  MOCKED_USTP_OFFICES_ARRAY.forEach((office) => {
    const group: CamsUserGroup = {
      id: randomUUID(),
      name: office.idpGroupName,
    };

    group.users = camsUsers
      .filter((user) =>
        user.offices.find((userOffice) => userOffice.officeCode === office.officeCode),
      )
      .map((user) => getCamsUserReference(user));

    camsUserGroups.set(office.idpGroupName, group);
  });
}

export class DevUserGroupGateway implements UserGroupGateway {
  async init(_config: UserGroupGatewayConfig, context: ApplicationContext): Promise<void> {
    await initializeGroups(context);
  }

  async getUserGroupWithUsers(
    context: ApplicationContext,
    groupName: string,
  ): Promise<CamsUserGroup> {
    await initializeGroups(context);
    if (!camsUserGroups.has(groupName)) {
      throw new NotFoundError(MODULE_NAME);
    }
    return camsUserGroups.get(groupName);
  }

  async getUserGroups(context: ApplicationContext): Promise<CamsUserGroup[]> {
    await initializeGroups(context);
    return Array.from(camsUserGroups.values()).map((group) => {
      return { id: group.id, name: group.name };
    });
  }

  async getUserGroupUsers(
    context: ApplicationContext,
    group: CamsUserGroup,
  ): Promise<CamsUserReference[]> {
    await initializeGroups(context);
    return camsUserGroups.get(group.name).users;
  }

  async getUserById(context: ApplicationContext, userId: string): Promise<CamsUser> {
    await initializeGroups(context);
    const devUsers = await loadDevUsers(context);
    const devUser = devUsers.find((u) => hashUsername(u.username) === userId);
    if (!devUser) {
      throw new NotFoundError(MODULE_NAME);
    }
    return devUserToCamsUser(devUser);
  }
}

export default DevUserGroupGateway;
