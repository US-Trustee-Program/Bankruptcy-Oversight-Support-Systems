import { UstpOfficeDetails } from '../../../../../common/src/cams/offices';
import { AttorneyUser, Staff } from '../../../../../common/src/cams/users';
import { ApplicationContext } from '../../adapters/types/basic';
import {
  getOfficesGateway,
  getUserGroupGateway,
  getOfficesRepository,
  getStorageGateway,
  getRuntimeStateRepository,
} from '../../factory';
import { OfficeStaffSyncState } from '../gateways.types';
import { USTP_OFFICE_NAME_MAP } from '../../adapters/gateways/dxtr/dxtr.constants';
import { CamsError } from '../../common-errors/cams-error';
import AttorneysList from '../attorneys';

const MODULE_NAME = 'OFFICES_USE_CASE';

export class OfficesUseCase {
  public async getOffices(context: ApplicationContext): Promise<UstpOfficeDetails[]> {
    const gateway = getOfficesGateway(context);
    return gateway.getOffices(context);
  }

  public async getOfficeAttorneys(
    context: ApplicationContext,
    officeCode: string,
  ): Promise<AttorneyUser[]> {
    let attorneys: AttorneyUser[] = [];
    if (context.featureFlags['restrict-case-assignment']) {
      const repository = getOfficesRepository(context);
      attorneys = await repository.getOfficeAttorneys(officeCode);
    } else {
      const attorneysUseCase = new AttorneysList();
      attorneys = await attorneysUseCase.getAttorneyList(context);
    }
    return attorneys;
  }

  public async syncOfficeStaff(context: ApplicationContext): Promise<object> {
    const config = context.config.userGroupGatewayConfig;
    const officesGateway = getOfficesGateway(context);
    const repository = getOfficesRepository(context);
    const userGroupSource = getUserGroupGateway(context);
    const storage = getStorageGateway(context);

    // Get IdP to CAMS mappings.
    const offices = await officesGateway.getOffices(context);
    const groupToRoleMap = storage.getRoleMapping();
    const groupToOfficeMap = offices.reduce((acc, office) => {
      acc.set(office.idpGroupId, office);
      return acc;
    }, new Map<string, UstpOfficeDetails>());

    // Filter out any groups not relevant to CAMS.
    const userGroups = await userGroupSource.getUserGroups(context, config);
    const officeGroups = userGroups.filter((group) => groupToOfficeMap.has(group.name));
    const roleGroups = userGroups.filter((group) => groupToRoleMap.has(group.name));

    // Map roles to users.
    const userMap = new Map<string, Staff>();
    for (const roleGroup of roleGroups) {
      const users = await userGroupSource.getUserGroupUsers(context, config, roleGroup);
      const role = groupToRoleMap.get(roleGroup.name);
      for (const user of users) {
        if (userMap.has(user.id)) {
          userMap.get(user.id).roles.push(role);
        } else {
          userMap.set(user.id, { ...user, roles: [role] });
        }
      }
    }

    // Write users with roles to the repo for each office.
    const officesWithUsers: UstpOfficeDetails[] = [];
    for (const officeGroup of officeGroups) {
      const office = { ...groupToOfficeMap.get(officeGroup.name), staff: [] };

      const users = await userGroupSource.getUserGroupUsers(context, config, officeGroup);
      for (const user of users) {
        if (!userMap.has(user.id)) {
          userMap.set(user.id, user);
        }
        const userWithRoles = userMap.has(user.id) ? userMap.get(user.id) : user;
        office.staff.push(userWithRoles);
        await repository.putOfficeStaff(office.officeCode, userWithRoles);
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

    await runtimeStateRepo.upsert(result);

    return result;
  }
}

export function buildOfficeCode(regionId: string, courtDivisionCode: string): string {
  // Synthesize an AD group name based on the DXTR values:
  const formattedRegionId = parseInt(regionId).toString();
  const formattedOfficeName = cleanOfficeName(getOfficeName(courtDivisionCode));
  return `USTP_CAMS_Region_${formattedRegionId}_Office_${formattedOfficeName}`;
}

export function getOfficeName(id: string): string {
  if (USTP_OFFICE_NAME_MAP.has(id)) return USTP_OFFICE_NAME_MAP.get(id);
  throw new CamsError(MODULE_NAME, {
    message: 'Cannot find office by ID',
    data: { id },
  });
}

function cleanOfficeName(name: string) {
  let officeName = name.replace(/\s/g, '_');
  officeName = officeName.replace(/[^_A-Z0-9]/gi, '');
  return officeName;
}
