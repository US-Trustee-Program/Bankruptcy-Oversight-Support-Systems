import { UstpOfficeDetails } from '../../../../common/src/cams/offices';
import { AttorneyUser, Staff } from '../../../../common/src/cams/users';
import { ApplicationContext } from '../../adapters/types/basic';
import {
  getOfficeAssigneesRepository,
  getOfficesGateway,
  getOfficesRepository,
  getOfficeStaffSyncStateRepo,
  getStorageGateway,
  getUserGroupGateway,
} from '../../factory';
import { OfficeStaffSyncState } from '../gateways.types';
import { USTP_OFFICE_NAME_MAP } from '../../adapters/gateways/dxtr/dxtr.constants';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import UsersHelpers from '../users/users.helpers';
import { sanitizeDeep } from '../validations';

const MODULE_NAME = 'OFFICES-USE-CASE';
export const DEFAULT_STAFF_TTL = 60 * 60 * 25;

export class OfficesUseCase {
  public async getOffices(context: ApplicationContext): Promise<UstpOfficeDetails[]> {
    const officesGateway = getOfficesGateway(context);
    const offices = await officesGateway.getOffices(context);

    const storageGateway = getStorageGateway(context);
    const metas = storageGateway.getUstpDivisionMeta();

    offices.forEach((ustpOffice) => {
      ustpOffice.groups.forEach((group) => {
        group.divisions.forEach((division) => {
          if (metas.has(division.divisionCode)) {
            division.isLegacy = metas.get(division.divisionCode).isLegacy;
          }
        });
      });
    });

    return offices;
  }

  public async getOfficeAttorneys(
    context: ApplicationContext,
    officeCode: string,
  ): Promise<AttorneyUser[]> {
    const repository = getOfficesRepository(context);
    return await repository.getOfficeAttorneys(officeCode);
  }

  public async getOfficeAssignees(
    context: ApplicationContext,
    officeCode: string,
  ): Promise<Staff[]> {
    const repository = getOfficeAssigneesRepository(context);
    return await repository.getDistinctAssigneesByOffice(officeCode);
  }

  public async syncOfficeStaff(context: ApplicationContext): Promise<object> {
    const officesGateway = getOfficesGateway(context);
    const repository = getOfficesRepository(context);
    const userGroupSource = await getUserGroupGateway(context);
    const storage = getStorageGateway(context);

    // Get IdP to CAMS mappings.
    const offices = await officesGateway.getOffices(context);
    const groupToRoleMap = storage.getRoleMapping();
    const groupToOfficeMap = offices.reduce((acc, office) => {
      acc.set(office.idpGroupName, office);
      return acc;
    }, new Map<string, UstpOfficeDetails>());

    // Filter out any groups not relevant to CAMS.
    const userGroups = sanitizeDeep(
      await userGroupSource.getUserGroups(context),
      MODULE_NAME,
      context.logger,
      false,
    );
    const officeGroups = userGroups.filter((group) => groupToOfficeMap.has(group.name));
    const roleGroups = userGroups.filter((group) => groupToRoleMap.has(group.name));

    // Map roles to users.
    const userMap = new Map<string, Staff>();
    for (const roleGroup of roleGroups) {
      const users = await userGroupSource.getUserGroupUsers(context, roleGroup);
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

      const users = await userGroupSource.getUserGroupUsers(context, officeGroup);
      let successCount = 0;
      let failureCount = 0;
      for (const user of users) {
        // TODO: check if user can be elevated and whether they have a PIM record
        if (!userMap.has(user.id)) {
          userMap.set(user.id, user);
        }
        const userWithRoles = userMap.get(user.id);
        const maybeElevatedUser = await UsersHelpers.getPrivilegedIdentityUser(context, user.id);
        userWithRoles.roles = maybeElevatedUser.roles;
        office.staff.push(userWithRoles);
        try {
          await repository.putOfficeStaff(office.officeCode, userWithRoles);
          successCount++;
        } catch (originalError) {
          const camsError = getCamsErrorWithStack(originalError, MODULE_NAME, {
            data: { office: office.officeCode, user: user.id },
          });
          context.logger.camsError(camsError);
          failureCount++;
        }
      }

      if (successCount > 0) {
        context.logger.info(
          MODULE_NAME,
          `Synced ${successCount} users to the ${office.officeName} office.`,
        );
      }
      if (failureCount > 0) {
        context.logger.info(
          MODULE_NAME,
          `Failed to sync ${failureCount} users to the ${office.officeName} office.`,
        );
      }
      officesWithUsers.push(office);
    }

    const result: OfficeStaffSyncState = {
      id: 'OFFICE_STAFF_SYNC_STATE',
      documentType: 'OFFICE_STAFF_SYNC_STATE',
      userGroups,
      users: [...userMap.values()],
      officesWithUsers,
    };

    const runtimeStateRepo = getOfficeStaffSyncStateRepo(context);

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

export function getOfficeName(divisionCode: string): string {
  if (USTP_OFFICE_NAME_MAP.has(divisionCode)) {
    return USTP_OFFICE_NAME_MAP.get(divisionCode);
  }
  return 'UNKNOWN_' + divisionCode;
}

function cleanOfficeName(name: string) {
  let officeName = name.replace(/\s/g, '_');
  officeName = officeName.replace(/[^_A-Z0-9]/gi, '');
  return officeName;
}
