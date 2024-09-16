import {
  Client,
  GroupApiListGroupsRequest,
  GroupApiListGroupUsersRequest,
} from '@okta/okta-sdk-nodejs';
import { CamsUserGroup, CamsUserReference } from '../../../../../../common/src/cams/users';
import { UserGroupGateway } from '../../types/authorization';
import { ApplicationContext } from '../../types/basic';
import { V2Configuration } from '@okta/okta-sdk-nodejs/src/types/configuration';
import { UnknownError } from '../../../common-errors/unknown-error';

const MODULE_NAME = 'OKTA_USER_GROUP_GATEWAY';
const MAX_PAGE_SIZE = 200;

let singleton: Client = undefined;

/**
 * initialize
 *
 * Creates an Okta Client instance and retains it is module scope as a singleton.
 * Subsequent calls to initialize return the previously created instance.
 *
 * See: https://github.com/okta/okta-sdk-nodejs?tab=readme-ov-file#oauth-20-authentication
 * See: https://github.com/okta/okta-sdk-nodejs?tab=readme-ov-file#known-issues
 *
 * @param _context ApplicationContext
 * @returns
 */
async function initialize(_context: ApplicationContext): Promise<Client> {
  // EXAMPLE CODE
  // const client = new okta.Client({
  //   orgUrl: 'https://dev-1234.oktapreview.com/',
  //   authorizationMode: 'PrivateKey',
  //   clientId: '{oauth application ID}',
  //   scopes: ['okta.users.manage'],
  //   privateKey: '{JWK}', // <-- see notes below
  //   keyId: 'kidValue'
  // });
  try {
    const config: V2Configuration = {
      // TODO: Map from context configuration
      orgUrl: 'https://oktasubdomain/',
      clientId: '{oauth application ID}',
      authorizationMode: 'PrivateKey',
      scopes: ['okta.groups.read'],
      privateKey: '{ private key JSON }',
      keyId: '',
    };
    if (!singleton) {
      singleton = new Client(config);
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
 * @param context ApplicationContext
 * @returns CamsUserGroup[]
 */
async function getUserGroups(context: ApplicationContext): Promise<CamsUserGroup[]> {
  const camsUserGroups: CamsUserGroup[] = [];
  try {
    const client = await initialize(context);
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
 * @param context ApplicationContext
 * @param group CamsUserGroup
 * @returns CamsUserReference[]
 */
async function getUserGroupUsers(
  context: ApplicationContext,
  group: CamsUserGroup,
): Promise<CamsUserReference[]> {
  const camsUserReferences: CamsUserReference[] = [];
  try {
    const client = await initialize(context);
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

export const OktaUserGroupGateway: UserGroupGateway = {
  getUserGroups,
  getUserGroupUsers,
};

export default OktaUserGroupGateway;
