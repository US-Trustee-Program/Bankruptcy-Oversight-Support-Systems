import {
  Client,
  GroupApiListGroupsRequest,
  GroupApiListGroupUsersRequest,
} from '@okta/okta-sdk-nodejs';
import { CamsUserGroup, CamsUserReference } from '../../../../../../common/src/cams/users';
import { UserGroupGateway, UserGroupGatewayConfig } from '../../types/authorization';
import { V2Configuration } from '@okta/okta-sdk-nodejs/src/types/configuration';
import { UnknownError } from '../../../common-errors/unknown-error';
import { ServerConfigError } from '../../../common-errors/server-config-error';

const MODULE_NAME = 'OKTA_USER_GROUP_GATEWAY';
const MAX_PAGE_SIZE = 200;

let singleton: Client = undefined;

function validateConfiguration(config: UserGroupGatewayConfig): void {
  if (config.provider != 'okta') {
    throw new ServerConfigError(MODULE_NAME, {
      message: `Invalid provider. Expected 'okta'. Received '${config.provider}'.`,
    });
  }
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
 * See: https://github.com/okta/okta-sdk-nodejs?tab=readme-ov-file#oauth-20-authentication
 * See: https://github.com/okta/okta-sdk-nodejs?tab=readme-ov-file#known-issues
 *
 * @param config UserGroupGatewayConfig
 * @returns
 */
export async function initialize(config: UserGroupGatewayConfig): Promise<Client> {
  validateConfiguration(config);
  try {
    const clientConfig: V2Configuration = {
      orgUrl: config.url,
      clientId: config.clientId,
      authorizationMode: 'PrivateKey',
      scopes: ['okta.groups.read'],
      privateKey: config.privateKey,
      keyId: config.keyId,
    };
    if (!singleton) {
      singleton = new Client(clientConfig);
    }
    return singleton;
  } catch (originalError) {
    throw new UnknownError(MODULE_NAME, { originalError });
  }
}

/**
 * getUserGroups
 *
 * Retrieves a list of Okta groups and transforms them into a list of CamsUserGroup.
 *
 * See: https://github.com/okta/okta-sdk-nodejs?tab=readme-ov-file#groups
 * See: https://developer.okta.com/docs/api/
 * See: https://developer.okta.com/docs/api/openapi/okta-management/management/tag/Group/#tag/Group/operation/listGroups
 *
 * @param config UserGroupGatewayConfig
 * @returns CamsUserGroup[]
 */
async function getUserGroups(config: UserGroupGatewayConfig): Promise<CamsUserGroup[]> {
  const camsUserGroups: CamsUserGroup[] = [];
  try {
    const client = await initialize(config);
    const query: GroupApiListGroupsRequest = {
      limit: MAX_PAGE_SIZE,
    };
    const oktaGroups = await client.groupApi.listGroups(query);

    for await (const oktaGroup of oktaGroups) {
      camsUserGroups.push({
        id: oktaGroup.id,
        name: oktaGroup.profile.name,
      });
    }
  } catch (originalError) {
    throw new UnknownError(MODULE_NAME, { originalError });
  }
  return camsUserGroups;
}

/**
 * getUserGroupUsers
 *
 * Retrieves a list of Okta users for a given Okta group and transforms them
 * into a list of CamsUserReference.
 *
 * See: https://github.com/okta/okta-sdk-nodejs?tab=readme-ov-file#groups
 * See: https://developer.okta.com/docs/api/
 * See: https://developer.okta.com/docs/api/openapi/okta-management/management/tag/Group/#tag/Group/operation/listGroupUsers
 *
 * @param config UserGroupGatewayConfig
 * @param group CamsUserGroup
 * @returns CamsUserReference[]
 */
async function getUserGroupUsers(
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
        name: oktaUser.profile.displayName,
      });
    }
  } catch (originalError) {
    throw new UnknownError(MODULE_NAME, { originalError });
  }
  return camsUserReferences;
}

export const OktaUserGroupGateway: UserGroupGateway & {
  initialize(config: UserGroupGatewayConfig);
} = {
  initialize,
  getUserGroups,
  getUserGroupUsers,
};

export default OktaUserGroupGateway;
