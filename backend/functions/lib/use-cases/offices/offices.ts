import { OfficeDetails, UstpOfficeDetails } from '../../../../../common/src/cams/courts';
import { CamsUserReference } from '../../../../../common/src/cams/users';
import { ApplicationContext } from '../../adapters/types/basic';
import {
  getOfficesGateway,
  getUserGroupGateway,
  getOfficesRepository,
  getStorageGateway,
  getRuntimeStateRepository,
} from '../../factory';
import { AttorneyUser } from '../../../../../common/src/cams/users';
import { OfficeStaffSyncState } from '../gateways.types';

const MODULE_NAME = 'OFFICES_USE_CASE';

export class OfficesUseCase {
  public async getOffices(context: ApplicationContext): Promise<OfficeDetails[]> {
    const gateway = getOfficesGateway(context);
    return gateway.getOffices(context);
  }

  public async getOfficeAttorneys(
    context: ApplicationContext,
    officeCode: string,
  ): Promise<AttorneyUser[]> {
    const repository = getOfficesRepository(context);
    return repository.getOfficeAttorneys(context, officeCode);
  }

  public async syncOfficeStaff(context: ApplicationContext): Promise<object> {
    const config = context.config.userGroupGatewayConfig;
    const repository = getOfficesRepository(context);
    const gateway = getUserGroupGateway(context);
    const storage = getStorageGateway(context);

    // Get IdP to CAMS mappings.
    const offices = storage.getUstpOffices();
    const groupToRoleMap = storage.getRoleMapping();
    const groupToOfficeMap = [...offices.values()].reduce((acc, office) => {
      acc.set(office.idpGroupId, office);
      return acc;
    }, new Map<string, UstpOfficeDetails>());

    // Filter out any groups not relevant to CAMS.
    const userGroups = await gateway.getUserGroups(context, config);
    const officeGroups = userGroups.filter((group) => groupToOfficeMap.has(group.name));
    const roleGroups = userGroups.filter((group) => groupToRoleMap.has(group.name));

    // Map roles to users.
    const userMap = new Map<string, CamsUserReference>();
    for (const roleGroup of roleGroups) {
      const users = await gateway.getUserGroupUsers(context, config, roleGroup);
      const role = groupToRoleMap.get(roleGroup.name);
      for (const user of users) {
        if (userMap.has(user.id)) {
          userMap.get(user.id).roles.push(role);
        } else {
          user.roles = [role];
          userMap.set(user.id, user);
        }
      }
    }

    // Write users with roles to the repo for each office.
    const officesWithUsers: UstpOfficeDetails[] = [];
    for (const officeGroup of officeGroups) {
      const office = { ...groupToOfficeMap.get(officeGroup.name), staff: [] };

      const users = await gateway.getUserGroupUsers(context, config, officeGroup);
      for (const user of users) {
        if (!userMap.has(user.id)) {
          userMap.set(user.id, user);
        }
        const userWithRoles = userMap.has(user.id) ? userMap.get(user.id) : user;
        office.staff.push(userWithRoles);
        await repository.putOfficeStaff(context, office.officeCode, userWithRoles);
      }

      context.logger.info(
        MODULE_NAME,
        `Synced ${users.length} users to the ${office.officeName} office.`,
      );
      officesWithUsers.push(office);
    }

    const result: OfficeStaffSyncState = {
      id: 'OFFICE_STAFF_SYNC_STATE',
      documentType: 'OFFICE_STAFF_SYNC_STATE',
      userGroups,
      users: [...userMap.values()],
      officesWithUsers,
    };

    const runtimeStateRepo = getRuntimeStateRepository(context);

    await runtimeStateRepo.updateState<OfficeStaffSyncState>(context, result);

    // TODO: What to do with users with roles WITHOUT offices?
    return result;
  }
}
