import { randomUUID } from 'crypto';
import { CamsUser, CamsUserGroup, CamsUserReference } from '../../../../common/src/cams/users';
import LocalStorageGateway from '../../adapters/gateways/storage/local-storage-gateway';
import { UserGroupGateway, UserGroupGatewayConfig } from '../../adapters/types/authorization';
import { ApplicationContext } from '../../adapters/types/basic';
import { MOCKED_USTP_OFFICES_ARRAY } from '../../../../common/src/cams/offices';
import { NotFoundError } from '../../common-errors/not-found-error';
import MockUsers from '../../../../common/src/cams/test-utilities/mock-user';
import { getCamsUserReference } from '../../../../common/src/cams/session';

const MODULE_NAME = 'MOCK_USER_GROUP_GATEWAY';

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
    name: office.idpGroupId,
  };

  group.users = MockUsers.filter(
    (user) => !!user.user.offices.find((office) => office.idpGroupId === office.idpGroupId),
  ).map((user) => getCamsUserReference(user.user));

  camsUserGroups.set(office.idpGroupId, group);
});

export class MockUserGroupGateway implements UserGroupGateway {
  init(_config: UserGroupGatewayConfig): Promise<void> {
    return;
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
  getUserById(_context: ApplicationContext, _userId: string): Promise<CamsUser> {
    throw new Error('Method not implemented.');
  }
}

export default MockUserGroupGateway;
