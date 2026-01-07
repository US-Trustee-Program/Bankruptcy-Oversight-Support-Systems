import { UserGroupsRepository } from '../gateways.types';
import { ApplicationContext } from '../../adapters/types/basic';
import { getUserGroupsRepository, getStorageGateway } from '../../factory';
import { Staff } from '../../../../common/src/cams/users';
import { OversightRole, OversightRoleType } from '../../../../common/src/cams/roles';

const MODULE_NAME = 'STAFF-USE-CASE';

export default class StaffUseCase {
  userGroupsRepository: UserGroupsRepository;

  constructor(context: ApplicationContext) {
    this.userGroupsRepository = getUserGroupsRepository(context);
  }

  async getOversightStaff(
    applicationContext: ApplicationContext,
  ): Promise<Record<OversightRoleType, Staff[]>> {
    const storage = getStorageGateway(applicationContext);
    const roleMapping = storage.getRoleMapping();

    // Pre-initialize result with all oversight roles mapped to empty arrays
    const oversightRoles = Array.from(OversightRole);
    const result = Object.fromEntries(oversightRoles.map((role) => [role, []])) as Record<
      OversightRoleType,
      Staff[]
    >;

    // Build reverse map: groupName → role (for oversight roles only)
    const groupNameToRole = new Map<string, OversightRoleType>();
    for (const [groupName, role] of roleMapping.entries()) {
      if (oversightRoles.includes(role)) {
        groupNameToRole.set(groupName, role as OversightRoleType);
      }
    }

    // Query for oversight role groups
    const groupNames = Array.from(groupNameToRole.keys());
    const groups = await this.userGroupsRepository.getUserGroupsByNames(
      applicationContext,
      groupNames,
    );

    applicationContext.logger.info(MODULE_NAME, `Retrieved ${groups.length} oversight role groups`);

    // Populate result with users for each role
    for (const group of groups) {
      const role = groupNameToRole.get(group.groupName);
      if (role) {
        result[role] = (group.users || []).map((user) => ({
          ...user,
          roles: [role],
        }));
      }
    }

    return result;
  }
}
