import { UstpOfficeDetails } from '../../../../../common/src/cams/offices';
import { AttorneyUser, CamsUserGroup, Staff } from '../../../../../common/src/cams/users';
import { ApplicationContext } from '../../adapters/types/basic';
import {
  getOfficesGateway,
  getUserGroupGateway,
  getOfficesRepository,
  getStorageGateway,
  getRuntimeStateRepository,
  Factory,
} from '../../factory';
import { OfficesRepository, OfficeStaffSyncState, RuntimeStateRepository } from '../gateways.types';
import { USTP_OFFICE_NAME_MAP } from '../../adapters/gateways/dxtr/dxtr.constants';
import { CamsError } from '../../common-errors/cams-error';
import AttorneysList from '../attorneys';
import { OfficesGateway } from './offices.types';
import { UserGroupGateway, UserGroupGatewayConfig } from '../../adapters/types/authorization';
import { StorageGateway } from '../../adapters/types/storage';

const MODULE_NAME = 'OFFICES_USE_CASE';

export class OfficesUseCase {
  private readonly config: UserGroupGatewayConfig;
  private readonly officesGateway: OfficesGateway;
  private readonly repository: OfficesRepository;
  private readonly userGroupSource: UserGroupGateway;
  private readonly storage: StorageGateway;
  private readonly runtimeStateRepo: RuntimeStateRepository<OfficeStaffSyncState>;

  constructor(context: ApplicationContext) {
    this.config = context.config.userGroupGatewayConfig;
    this.officesGateway = Factory.getOfficesGateway(context);
    this.repository = Factory.getOfficesRepository(context);
    this.userGroupSource = Factory.getUserGroupGateway(context);
    this.storage = Factory.getStorageGateway(context);
    this.runtimeStateRepo = Factory.getRuntimeStateRepository(context);
  }

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

  public async syncOfficeStaff(context: ApplicationContext, weekly: boolean): Promise<object> {
    if (weekly) {
      return await this.weeklySync(context);
    } else {
      return await this.partialSync(context);
    }
  }

  // THIS IS AN ATTEMPT TO SUBDIVIDE THE ORIGINAL SYNC FUNCTION INTO SMALLER FUNCTIONS.
  private async getRoleGroups(context: ApplicationContext) {
    const groupToRoleMap = this.storage.getRoleMapping();

    // TODO: We should probably just iteratively request the role user groups by name from Okta rather than bring ALL group back.
    const userGroups = await this.userGroupSource.getUserGroups(context, this.config);
    const roleGroups = userGroups.filter((group) => groupToRoleMap.has(group.name));
    return roleGroups;
  }

  // THIS IS AN ATTEMPT TO SUBDIVIDE THE ORIGINAL SYNC FUNCTION INTO SMALLER FUNCTIONS.
  private async getOfficeGroups(context: ApplicationContext, lastMembershipUpdated?: string) {
    const offices = await this.officesGateway.getOffices(context);
    const groupToOfficeMap = offices.reduce((acc, office) => {
      acc.set(office.idpGroupId, office);
      return acc;
    }, new Map<string, UstpOfficeDetails>());

    const userGroups = await this.userGroupSource.getUserGroups(
      context,
      this.config,
      lastMembershipUpdated,
    );

    const officeGroups = userGroups.filter((group) => groupToOfficeMap.has(group.name));
    return officeGroups;
  }

  private async getUsersForGroup(context: ApplicationContext, userGroup: CamsUserGroup) {
    return this.userGroupSource.getUserGroupUsers(context, this.config, userGroup);
  }

  // THIS IS AN ATTEMPT TO SUBDIVIDE THE ORIGINAL SYNC FUNCTION INTO SMALLER FUNCTIONS.
  private async applyRoles(
    context: ApplicationContext,
    users: Map<string, Staff>,
  ): Promise<Map<string, Staff>> {
    const config = context.config.userGroupGatewayConfig;
    const groupToRoleMap = this.storage.getRoleMapping();
    const roleGroups = await this.getRoleGroups(context);

    const userMap = new Map<string, Staff>();
    for (const roleGroup of roleGroups) {
      const users = await this.userGroupSource.getUserGroupUsers(context, config, roleGroup);
      const role = groupToRoleMap.get(roleGroup.name);
      for (const user of users) {
        if (userMap.has(user.id)) {
          userMap.get(user.id).roles.push(role);
        } else {
          // TODO: Don't add users to the list if we are only APPLYING roles to the users
          // userMap.set(user.id, { ...user, roles: [role] });
        }
      }
    }
    return users;
  }

  // THIS IS THE ORIGINAL SYNC FUNCTION!!
  private async weeklySync(context: ApplicationContext) {
    const executionStartTime = new Date().toISOString();

    //TODO: Do not instantiate these individually for the weekly/partial syncs
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
        // TODO: the following line is partially covered and I cannot see how we would reach the negative case
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
      lastModifiedDate: executionStartTime,
    };

    const runtimeStateRepo = getRuntimeStateRepository(context);

    await runtimeStateRepo.upsert(result);

    return result;
  }

  private async partialSync(_context: ApplicationContext) {
    //Do the partial sync
    // const config = context.config.userGroupGatewayConfig;
    // const officesGateway = Factory.getOfficesGateway(context);
    // const repository = Factory.getOfficesRepository(context);
    // const userGroupSource = Factory.getUserGroupGateway(context);
    // const storage = Factory.getStorageGateway(context);
    // const runtimeStateRepo = Factory.getRuntimeStateRepository<OfficeStaffSyncState>(context);
    // const stateType: RuntimeStateDocumentType = 'OFFICE_STAFF_SYNC_STATE';
    // const lastRunState = await runtimeStateRepo.read(stateType);
    // // lastMembershipUpdated
    // const userGroupsWithChangedMembership = await userGroupSource.getUserGroups(
    //   context,
    //   config,
    //   lastRunState.lastModifiedDate,
    // );
    // const result = { foo: 'something' };
    // return result;
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
