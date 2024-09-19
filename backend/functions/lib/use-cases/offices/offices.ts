import { OfficeDetails } from '../../../../../common/src/cams/courts';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { CamsUserReference } from '../../../../../common/src/cams/users';
import { ApplicationContext } from '../../adapters/types/basic';
import { getOfficesGateway, getUserGroupGateway, getOfficesRepository } from '../../factory';
import { AttorneyUser } from '../../../../../common/src/cams/users';

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

  public async syncOfficeStaff(applicationContext: ApplicationContext): Promise<object> {
    const results = {
      userGroups: [],
    };

    const gateway = getUserGroupGateway(applicationContext);
    // TODO: get repo gateway

    const config = applicationContext.config.userGroupGatewayConfig;
    const userGroups = await gateway.getUserGroups(config);
    const userMap = new Map<string, CamsUserReference>();

    // TODO: implement the filter.
    const roleGroups = userGroups.filter(() => true);
    for (const roleGroup of roleGroups) {
      const users = await gateway.getUserGroupUsers(config, roleGroup);
      // TODO: Set the appropriate role for the group.
      const role = CamsRole.TrialAttorney;
      for (const user of users) {
        if (userMap.has(user.id)) {
          userMap.get(user.id).roles.push(role);
        } else {
          user.roles.push(role);
          userMap.set(user.id, user);
        }
      }
      results.userGroups.push(roleGroup);
    }

    // TODO: implement the filter.
    const officeGroups = userGroups.filter(() => true);
    for (const officeGroup of officeGroups) {
      // TODO: Map the group name to the office Id.
      const officeId = '';
      const users = await gateway.getUserGroupUsers(config, officeGroup);
      for (const user of users) {
        const userWithRoles = userMap.has(user.id) ? userMap.get(user.id) : user;
        console.log(officeId, userWithRoles);
        // TODO: Write user document to repo
      }
    }

    return results;
  }
}
