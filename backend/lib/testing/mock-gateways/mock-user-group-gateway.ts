import { randomUUID } from 'crypto';

import { MOCKED_USTP_OFFICES_ARRAY } from '../../../../common/src/cams/offices';
import { getCamsUserReference } from '../../../../common/src/cams/session';
import MockUsers from '../../../../common/src/cams/test-utilities/mock-user';
import { CamsUser, CamsUserGroup, CamsUserReference } from '../../../../common/src/cams/users';
import LocalStorageGateway from '../../adapters/gateways/storage/local-storage-gateway';
import { UserGroupGateway, UserGroupGatewayConfig } from '../../adapters/types/authorization';
import { ApplicationContext } from '../../adapters/types/basic';
import { NotFoundError } from '../../common-errors/not-found-error';

const MODULE_NAME = 'MOCK-USER-GROUP-GATEWAY';

const camsUserGroups = new Map<string, CamsUserGroup>();

// Add the roles.
LocalStorageGateway.getRoleMapping().forEach((camsRole, groupName) => {
  const group: CamsUserGroup = {
    id: randomUUID(),
    name: groupName,
  };

  group.users = MockUsers.filter((user) => !!user.user.roles.find((role) => role === camsRole)).map(
    (user) => getCamsUserReference(user.user),
  );

  camsUserGroups.set(groupName, group);
});

// Add the locations.
MOCKED_USTP_OFFICES_ARRAY.forEach((office) => {
  const group: CamsUserGroup = {
    id: randomUUID(),
    name: office.idpGroupName,
  };

  group.users = MockUsers.filter(
    (user) => !!user.user.offices.find((office) => office.idpGroupName === office.idpGroupName),
  ).map((user) => getCamsUserReference(user.user));

  camsUserGroups.set(office.idpGroupName, group);
});

export class MockUserGroupGateway implements UserGroupGateway {
  async getUserById(_context: ApplicationContext, userId: string): Promise<CamsUser> {
    const userMeta = MockUsers.find((userMeta) => userMeta.user.id === userId);
    if (!userMeta) {
      throw new NotFoundError(MODULE_NAME);
    }
    return userMeta.user;
  }
  async getUserGroups(_context: ApplicationContext): Promise<CamsUserGroup[]> {
    return Array.from(camsUserGroups.values()).map((group) => {
      return { id: group.id, name: group.name };
    });
  }
  async getUserGroupUsers(
    _context: ApplicationContext,
    group: CamsUserGroup,
  ): Promise<CamsUserReference[]> {
    return camsUserGroups.get(group.name).users;
  }
  async getUserGroupWithUsers(
    _context: ApplicationContext,
    groupName: string,
  ): Promise<CamsUserGroup> {
    if (!camsUserGroups.has(groupName)) {
      throw new NotFoundError(MODULE_NAME);
    }
    const camsUserGroup = camsUserGroups.get(groupName);
    return camsUserGroup;
  }
  init(_config: UserGroupGatewayConfig): Promise<void> {
    return;
  }
}

export default MockUserGroupGateway;
