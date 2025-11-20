import { randomUUID } from 'crypto';
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

const MODULE_NAME = 'DEV-USER-GROUP-GATEWAY';

function loadDevUsers(): DevUser[] {
  const devUsersEnv = process.env.DEV_USERS;
  if (!devUsersEnv) {
    return [];
  }

  try {
    const users = JSON.parse(devUsersEnv);
    if (!Array.isArray(users)) {
      return [];
    }
    return users as DevUser[];
  } catch (_error) {
    return [];
  }
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
    id: devUser.username,
    name: devUser.name || devUser.username,
    roles,
    offices,
  };
}

const camsUserGroups = new Map<string, CamsUserGroup>();

function initializeGroups() {
  if (camsUserGroups.size > 0) return;

  const devUsers = loadDevUsers();
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
  init(_config: UserGroupGatewayConfig): Promise<void> {
    initializeGroups();
    return;
  }

  async getUserGroupWithUsers(
    _context: ApplicationContext,
    groupName: string,
  ): Promise<CamsUserGroup> {
    initializeGroups();
    if (!camsUserGroups.has(groupName)) {
      throw new NotFoundError(MODULE_NAME);
    }
    const camsUserGroup = camsUserGroups.get(groupName);
    return camsUserGroup;
  }

  async getUserGroups(_context: ApplicationContext): Promise<CamsUserGroup[]> {
    initializeGroups();
    return Array.from(camsUserGroups.values()).map((group) => {
      return { id: group.id, name: group.name };
    });
  }

  async getUserGroupUsers(
    _context: ApplicationContext,
    group: CamsUserGroup,
  ): Promise<CamsUserReference[]> {
    initializeGroups();
    return camsUserGroups.get(group.name).users;
  }

  async getUserById(_context: ApplicationContext, userId: string): Promise<CamsUser> {
    initializeGroups();
    const devUsers = loadDevUsers();
    const devUser = devUsers.find((u) => u.username === userId);
    if (!devUser) {
      throw new NotFoundError(MODULE_NAME);
    }
    return devUserToCamsUser(devUser);
  }
}

export default DevUserGroupGateway;
