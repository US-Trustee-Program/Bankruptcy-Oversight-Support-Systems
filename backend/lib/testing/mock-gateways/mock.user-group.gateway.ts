import { CamsUserGroup, CamsUserReference, CamsUser } from '../../../../common/src/cams/users';
import { UserGroupGateway, UserGroupGatewayConfig } from '../../adapters/types/authorization';
import { ApplicationContext } from '../../adapters/types/basic';

export class MockUserGroupGateway implements UserGroupGateway {
  init(_config: UserGroupGatewayConfig): Promise<void> {
    throw new Error('Method not implemented.');
  }
  getUserGroupWithUsers(_context: ApplicationContext, _groupName: string): Promise<CamsUserGroup> {
    throw new Error('Method not implemented.');
  }
  getUserGroups(_context: ApplicationContext): Promise<CamsUserGroup[]> {
    throw new Error('Method not implemented.');
  }
  getUserGroupUsers(
    _context: ApplicationContext,
    _group: CamsUserGroup,
  ): Promise<CamsUserReference[]> {
    throw new Error('Method not implemented.');
  }
  getUserById(_context: ApplicationContext, _userId: string): Promise<CamsUser> {
    throw new Error('Method not implemented.');
  }
}
