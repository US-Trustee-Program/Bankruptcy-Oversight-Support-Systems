import { UserGroupsRepository } from '../gateways.types';
import { ApplicationContext } from '../../adapters/types/basic';
import { getUserGroupsRepository, getStorageGateway } from '../../factory';
import { Staff } from '../../../../common/src/cams/users';
import { CamsRoleType, OversightRole } from '../../../../common/src/cams/roles';

const MODULE_NAME = 'STAFF-USE-CASE';

export default class StaffUseCase {
  userGroupsRepository: UserGroupsRepository;

  constructor(context: ApplicationContext) {
    this.userGroupsRepository = getUserGroupsRepository(context);
  }

  async getOversightStaff(
    applicationContext: ApplicationContext,
  ): Promise<Record<string, Staff[]>> {
    const storage = getStorageGateway(applicationContext);
    const roleMapping = storage.getRoleMapping();

    // Build reverse map: groupName → role (for oversight roles only)
    const oversightRoles: CamsRoleType[] = Object.values(OversightRole);
    const groupNameToRole = new Map<string, string>();
    for (const [groupName, role] of roleMapping.entries()) {
      if (oversightRoles.includes(role)) {
        groupNameToRole.set(groupName, role);
      }
    }

    // Query for oversight role groups
    const groupNames = Array.from(groupNameToRole.keys());
    const groups = await this.userGroupsRepository.getUserGroupsByNames(
      applicationContext,
      groupNames,
    );

    applicationContext.logger.info(MODULE_NAME, `Retrieved ${groups.length} oversight role groups`);

    // Build response: role → users with roles array
    const result: Record<string, Staff[]> = {};
    for (const group of groups) {
      const role = groupNameToRole.get(group.groupName);
      if (role) {
        // Convert CamsUserReference to Staff by adding roles array
        result[role] = (group.users || []).map((user) => ({
          ...user,
          roles: [role as CamsRoleType],
        }));
      }
    }

    return result;
  }
}
