import { CamsUser, CamsUserGroup, CamsUserReference } from '../../../../../common/src/cams/users';
import { UserGroupGateway, UserGroupGatewayConfig } from '../../types/authorization';
import { UnknownError } from '../../../common-errors/unknown-error';
import { ApplicationContext } from '../../types/basic';
import {
  getOfficesFromGroupNames,
  getRolesFromGroupNames,
} from '../../../use-cases/user-session/user-session';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import OktaHumble, {
  ListGroupsRequest,
  ListGroupUsersRequest,
} from '../../../humble-objects/okta-humble';

const MODULE_NAME = 'OKTA_USER_GROUP_GATEWAY';
const MAX_PAGE_SIZE = 200;

class OktaUserGroupGateway implements UserGroupGateway {
  private oktaHumble: OktaHumble;

  constructor() {
    this.oktaHumble = new OktaHumble();
  }

  public async init(config: UserGroupGatewayConfig): Promise<void> {
    return await this.oktaHumble.init(config);
  }

  /**
   * getUserGroups
   *
   * Retrieves a list of Okta groups and transforms them into a list of CamsUserGroup.
   *
   * @see https://github.com/okta/okta-sdk-nodejs?tab=readme-ov-file#groups
   * @see https://developer.okta.com/docs/api/
   * @see https://developer.okta.com/docs/api/openapi/okta-management/management/tag/Group/#tag/Group/operation/listGroups
   *
   * @param {ApplicationContext} context
   * @returns {CamsUserGroup[]}
   */
  async getUserGroups(context: ApplicationContext): Promise<CamsUserGroup[]> {
    const request: ListGroupsRequest = {
      query: 'USTP CAMS',
      limit: MAX_PAGE_SIZE,
    };
    try {
      const oktaGroups = await this.oktaHumble.listGroups(request);
      context.logger.info(MODULE_NAME, `Retrieved ${oktaGroups.length} groups.`);
      return oktaGroups;
    } catch (originalError) {
      const message = 'Failed to retrieve groups.';
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message,
        camsStackInfo: {
          message,
          module: MODULE_NAME,
        },
      });
    }
  }

  /**
   * getUserGroup
   *
   * Retrieves a group by name with group members.
   *
   * @param {ApplicationContext} context
   * @param {string} groupName
   */
  async getUserGroupWithUsers(
    context: ApplicationContext,
    groupName: string,
  ): Promise<CamsUserGroup> {
    try {
      const request: ListGroupsRequest = {
        query: groupName,
        limit: MAX_PAGE_SIZE,
      };
      const oktaGroups = await this.oktaHumble.listGroups(request);
      if (oktaGroups.length !== 1) {
        throw new UnknownError(MODULE_NAME, {
          message: `Found ${oktaGroups.length} groups matching ${groupName}, expected 1.`,
        });
      }

      const camsUserGroup: CamsUserGroup = {
        id: oktaGroups[0].id,
        name: oktaGroups[0].name,
      };
      camsUserGroup.users = await this.getUserGroupUsers(context, camsUserGroup);
      context.logger.info(
        MODULE_NAME,
        `Retrieved ${groupName} group with ${camsUserGroup.users.length} users.`,
      );
      return camsUserGroup;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to retrieve ${groupName} group.`,
          module: MODULE_NAME,
        },
      });
    }
  }

  /**
   * getUserGroupUsers
   *
   * Retrieves a list of Okta users for a given Okta group and transforms them
   * into a list of CamsUserReference.
   *
   * @see https://github.com/okta/okta-sdk-nodejs?tab=readme-ov-file#groups
   * @see https://developer.okta.com/docs/api/
   * @see https://developer.okta.com/docs/api/openapi/okta-management/management/tag/Group/#tag/Group/operation/listGroupUsers
   *
   * @param {ApplicationContext} context
   * @param {CamsUserGroup} group
   * @returns {CamsUserReference[]}
   */
  async getUserGroupUsers(
    context: ApplicationContext,
    group: CamsUserGroup,
  ): Promise<CamsUserReference[]> {
    try {
      const request: ListGroupUsersRequest = {
        groupId: group.id,
        limit: MAX_PAGE_SIZE,
      };
      const oktaUsers = await this.oktaHumble.listGroupUsers(request);
      context.logger.info(MODULE_NAME, `Retrieved ${oktaUsers.length} users.`);
      return oktaUsers;
    } catch (originalError) {
      const message = 'Failed to retrieve users.';
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message,
        camsStackInfo: {
          message,
          module: MODULE_NAME,
        },
      });
    }
  }

  async getUserById(context: ApplicationContext, id: string): Promise<CamsUser> {
    try {
      const user = await this.oktaHumble.getUser({ userId: id });
      const groups = await this.oktaHumble.listUserGroups({ userId: id });
      const groupIds = [];
      const groupNames = [];
      for await (const oktaGroup of groups) {
        groupIds.push(oktaGroup.id);
        groupNames.push(oktaGroup.name);
      }
      const camsUser = {
        id: user.id,
        name: user.name,
        offices: await getOfficesFromGroupNames(context, groupIds),
        roles: getRolesFromGroupNames(groupNames),
      };
      context.logger.info(MODULE_NAME, `Retrieved ${id}`, camsUser);
      return camsUser;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: { module: MODULE_NAME, message: 'Failed while getting user by id.' },
      });
    }
  }
}

export default OktaUserGroupGateway;
