import { UserGroupsRepository } from '../gateways.types';
import { ApplicationContext } from '../../adapters/types/basic';
import { getUserGroupsRepository, getStorageGateway } from '../../factory';
import { CamsUserReference } from '../../../../common/src/cams/users';
import { CamsRole } from '../../../../common/src/cams/roles';

const MODULE_NAME = 'STAFF-USE-CASE';

// Oversight roles that we query for
const OVERSIGHT_ROLES = [CamsRole.TrialAttorney, CamsRole.Auditor, CamsRole.Paralegal];

export default class StaffUseCase {
  userGroupsRepository: UserGroupsRepository;

  constructor(context: ApplicationContext) {
    this.userGroupsRepository = getUserGroupsRepository(context);
  }

  async getOversightStaff(
    applicationContext: ApplicationContext,
  ): Promise<Record<string, CamsUserReference[]>> {
    const storage = getStorageGateway(applicationContext);
    const roleMapping = storage.getRoleMapping(); // Map<groupName, CamsRole>

    // Build reverse map: groupName → role (for oversight roles only)
    const groupNameToRole = new Map<string, string>();
    for (const [groupName, role] of roleMapping.entries()) {
      if (OVERSIGHT_ROLES.includes(role)) {
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

    // Build response: role → users
    const result: Record<string, CamsUserReference[]> = {};
    for (const group of groups) {
      const role = groupNameToRole.get(group.groupName);
      if (role) {
        result[role] = group.users || [];
      }
    }

    return result;
  }
}
