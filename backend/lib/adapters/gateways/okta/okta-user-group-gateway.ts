import {
  Client,
  GroupApiListGroupsRequest,
  GroupApiListGroupUsersRequest,
} from '@okta/okta-sdk-nodejs';
import { CamsUser, CamsUserGroup, CamsUserReference } from '../../../../../common/src/cams/users';
import { UserGroupGateway, UserGroupGatewayConfig } from '../../types/authorization';
import { V2Configuration } from '@okta/okta-sdk-nodejs/src/types/configuration';
import { UnknownError } from '../../../common-errors/unknown-error';
import { ServerConfigError } from '../../../common-errors/server-config-error';
import { isCamsError } from '../../../common-errors/cams-error';
import { ApplicationContext } from '../../types/basic';
import {
  getOfficesFromGroupNames,
  getRolesFromGroupNames,
} from '../../../use-cases/user-session/user-session';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';

const MODULE_NAME = 'OKTA_USER_GROUP_GATEWAY';
const MAX_PAGE_SIZE = 200;

let singleton: Client = undefined;

function validateConfiguration(config: UserGroupGatewayConfig): void {
  if (config.provider != 'okta') {
    throw new ServerConfigError(MODULE_NAME, {
      message: `Invalid provider. Expected 'okta'. Received '${config.provider}'.`,
    });
  }
  // API Key Configuration
  if (config.token) {
    return;
  }
  // Private Key Configuration
  const required: (keyof UserGroupGatewayConfig)[] = ['clientId', 'keyId', 'url', 'privateKey'];
  required.forEach((key) => {
    if (!config[key]) {
      throw new ServerConfigError(MODULE_NAME, {
        message: `Missing configuration. Expected '${key}'.'`,
      });
    }
  });
}

/**
 * initialize
 *
 * Creates an Okta Client instance and retains it in module scope as a singleton.
 * Subsequent calls to initialize return the previously created instance.
 *
 * @see https://github.com/okta/okta-sdk-nodejs?tab=readme-ov-file#oauth-20-authentication
 * @see https://github.com/okta/okta-sdk-nodejs?tab=readme-ov-file#known-issues
 *
 * @param {UserGroupGatewayConfig} config
 * @returns {Client}
 */
export async function initialize(config: UserGroupGatewayConfig): Promise<Client> {
  validateConfiguration(config);
  let clientConfig: V2Configuration;
  try {
    if (!singleton) {
      if (config.token) {
        clientConfig = {
          orgUrl: config.url,
          token: config.token,
          authorizationMode: 'SSWS',
        };
      } else {
        clientConfig = {
          orgUrl: config.url,
          clientId: config.clientId,
          authorizationMode: 'PrivateKey',
          scopes: ['okta.groups.read'],
          privateKey: JSON.parse(config.privateKey),
          keyId: config.keyId,
        };
      }
      singleton = new Client(clientConfig);
    }
    return singleton;
  } catch (originalError) {
    throw isCamsError(originalError)
      ? originalError
      : new UnknownError(MODULE_NAME, { originalError, message: 'Failed to initialize.' });
  }
}

/**
 * getUserGroup
 *
 * Retrieves a group by name.
 *
 * @param {ApplicationContext} context
 * @param {UserGroupGatewayConfig} config
 * @param {string} groupName
 */
async function getUserGroupWithUsers(
  context: ApplicationContext,
  config: UserGroupGatewayConfig,
  groupName: string,
): Promise<CamsUserGroup> {
  try {
    const client = await initialize(config);
    const query: GroupApiListGroupsRequest = {
      q: groupName,
      limit: MAX_PAGE_SIZE,
    };
    const oktaGroups = await client.groupApi.listGroups(query);

    let camsUserGroup: CamsUserGroup;
    for await (const oktaGroup of oktaGroups) {
      camsUserGroup = {
        id: oktaGroup.id,
        name: oktaGroup.profile.name,
      };
      camsUserGroup.users = await getUserGroupUsers(context, config, camsUserGroup);
    }
    context.logger.info(
      MODULE_NAME,
      `Retrieved ${groupName} group with ${camsUserGroup.users.length} users.`,
    );
    return camsUserGroup;
  } catch (originalError) {
    throw isCamsError(originalError)
      ? originalError
      : new UnknownError(MODULE_NAME, {
          originalError,
          message: `Failed to retrieve ${groupName} group.`,
        });
  }
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
 * @param {UserGroupGatewayConfig} config
 * @returns {CamsUserGroup[]}
 */
async function getUserGroups(
  context: ApplicationContext,
  config: UserGroupGatewayConfig,
): Promise<CamsUserGroup[]> {
  const camsUserGroups: CamsUserGroup[] = [];
  try {
    const client = await initialize(config);
    const query: GroupApiListGroupsRequest = {
      q: 'USTP CAMS',
      limit: MAX_PAGE_SIZE,
    };
    const oktaGroups = await client.groupApi.listGroups(query);

    for await (const oktaGroup of oktaGroups) {
      camsUserGroups.push({
        id: oktaGroup.id,
        name: oktaGroup.profile.name,
      });
    }
    context.logger.info(MODULE_NAME, `Retrieved ${camsUserGroups.length} groups.`);
  } catch (originalError) {
    throw isCamsError(originalError)
      ? originalError
      : new UnknownError(MODULE_NAME, { originalError, message: 'Failed to retrieve groups.' });
  }
  return camsUserGroups;
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
 * @param {UserGroupGatewayConfig} config
 * @param {CamsUserGroup} group
 * @returns {CamsUserReference[]}
 */
async function getUserGroupUsers(
  context: ApplicationContext,
  config: UserGroupGatewayConfig,
  group: CamsUserGroup,
): Promise<CamsUserReference[]> {
  const camsUserReferences: CamsUserReference[] = [];
  try {
    const client = await initialize(config);
    const query: GroupApiListGroupUsersRequest = {
      groupId: group.id,
      limit: MAX_PAGE_SIZE,
    };
    const oktaUsers = await client.groupApi.listGroupUsers(query);

    for await (const oktaUser of oktaUsers) {
      camsUserReferences.push({
        id: oktaUser.id,
        name:
          oktaUser.profile.displayName ??
          oktaUser.profile.lastName + ', ' + oktaUser.profile.firstName,
      });
    }
    context.logger.info(MODULE_NAME, `Retrieved ${camsUserReferences.length} users.`);
  } catch (originalError) {
    throw isCamsError(originalError)
      ? originalError
      : new UnknownError(MODULE_NAME, { originalError, message: 'Failed to retrieve users.' });
  }
  return camsUserReferences;
}

async function getUserById(
  context: ApplicationContext,
  config: UserGroupGatewayConfig,
  id: string,
): Promise<CamsUser> {
  const client = await initialize(config);
  let camsUser: CamsUser;
  try {
    const user = await client.userApi.getUser({ userId: id });
    const groups = await client.userApi.listUserGroups({ userId: id });
    const groupIds = [];
    const groupNames = [];
    for await (const oktaGroup of groups) {
      groupIds.push(oktaGroup.id);
      groupNames.push(oktaGroup.profile.name);
    }
    camsUser = {
      id: user.id,
      name: user.profile.displayName ?? user.profile.lastName + ', ' + user.profile.firstName,
      offices: await getOfficesFromGroupNames(context, groupIds),
      roles: getRolesFromGroupNames(groupNames),
    };
  } catch (originalError) {
    throw getCamsErrorWithStack(originalError, MODULE_NAME, {
      camsStackInfo: { module: MODULE_NAME, message: 'Failed while getting user by id.' },
    });
  }
  context.logger.info(MODULE_NAME, `Retrieved ${id}`, camsUser);
  return camsUser;
}

export const OktaUserGroupGateway: UserGroupGateway & {
  initialize(config: UserGroupGatewayConfig);
} = {
  initialize,
  getUserGroupWithUsers,
  getUserGroups,
  getUserGroupUsers,
  getUserById,
};

export default OktaUserGroupGateway;
