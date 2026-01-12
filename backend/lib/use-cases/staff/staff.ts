import { UserGroupsRepository } from '../gateways.types';
import { ApplicationContext } from '../../adapters/types/basic';
import { getUserGroupsRepository, getStorageGateway } from '../../factory';
import { Staff } from '@common/cams/users';
import { OversightRoles, OversightRoleType } from '@common/cams/roles';

const MODULE_NAME = 'STAFF-USE-CASE';

export default class StaffUseCase {
  userGroupsRepository: UserGroupsRepository;

  constructor(context: ApplicationContext) {
    this.userGroupsRepository = getUserGroupsRepository(context);
  }

  private buildOversightGroupMapping(applicationContext: ApplicationContext): {
    roleToEmptyStaff: Record<OversightRoleType, Staff[]>;
    groupNameToRole: Map<string, OversightRoleType>;
  } {
    const storage = getStorageGateway(applicationContext);
    const roleMapping = storage.getRoleMapping();

    // Pre-initialize result with all oversight roles mapped to empty arrays
    const roleToEmptyStaff: Record<OversightRoleType, Staff[]> = {} as Record<
      OversightRoleType,
      Staff[]
    >;
    for (const role of OversightRoles) {
      roleToEmptyStaff[role] = [];
    }

    // Build reverse map: groupName → role (for oversight roles only)
    const groupNameToRole = new Map<string, OversightRoleType>();
    for (const [groupName, role] of roleMapping.entries()) {
      if (OversightRoles.includes(role as OversightRoleType)) {
        groupNameToRole.set(groupName, role as OversightRoleType);
      }
    }

    return { roleToEmptyStaff, groupNameToRole };
  }

  async getOversightStaff(
    applicationContext: ApplicationContext,
  ): Promise<Record<OversightRoleType, Staff[]>> {
    const { roleToEmptyStaff: result, groupNameToRole } =
      this.buildOversightGroupMapping(applicationContext);

    if (groupNameToRole.size === 0) {
      applicationContext.logger.info(
        MODULE_NAME,
        'No oversight role groups configured in storage, returning empty result',
      );
      return result;
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
      if (!role) continue;

      result[role] = (group.users || []).map((user) => ({
        ...user,
        roles: [role],
      }));
    }

    return result;
  }
}
