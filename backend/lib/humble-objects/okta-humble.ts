import { Client, GroupApiListGroupsRequest } from '@okta/okta-sdk-nodejs';
import { UserGroupGatewayConfig } from '../adapters/types/authorization';
import { V2Configuration } from '@okta/okta-sdk-nodejs/src/types/configuration';
import { isCamsError } from '../common-errors/cams-error';
import { UnknownError } from '../common-errors/unknown-error';
import { ServerConfigError } from '../common-errors/server-config-error';
import { UserApiListUserGroupsRequest } from '@okta/okta-sdk-nodejs/src/types/generated/types/ObjectParamAPI';
import { CamsUserGroup, CamsUserReference } from '../../../common/src/cams/users';
import { getCamsErrorWithStack } from '../common-errors/error-utilities';

const MODULE_NAME = 'OKTA-HUMBLE';

export type ListGroupsRequest = {
  query?: string;
  limit?: number;
};

export type ListGroupUsersRequest = {
  groupId: string;
  limit?: number;
};

export type UserRequest = {
  userId: string;
};

export type UserGroupsRequest = {
  userId: string;
};

export type IdpGroup = {
  id: string;
  name: string;
};

export class OktaHumble {
  private client: Client;

  public async init(config: UserGroupGatewayConfig): Promise<void> {
    return await this.initialize(config);
  }

  async listGroups(request: ListGroupsRequest): Promise<CamsUserGroup[]> {
    const camsUserGroups: CamsUserGroup[] = [];
    try {
      const oktaRequest: GroupApiListGroupsRequest = {
        q: request.query,
        limit: request.limit,
      };
      const oktaGroups = await this.client.groupApi.listGroups(oktaRequest);

      for await (const oktaGroup of oktaGroups) {
        camsUserGroups.push({
          id: oktaGroup.id,
          name: oktaGroup.profile.name,
        });
      }
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: 'Failed to retrieve groups.',
          module: MODULE_NAME,
        },
      });
    }
    return camsUserGroups;
  }

  async listGroupUsers(request: ListGroupUsersRequest): Promise<CamsUserReference[]> {
    const camsUserReferences: CamsUserReference[] = [];
    try {
      const oktaUsers = await this.client.groupApi.listGroupUsers(request);

      for await (const oktaUser of oktaUsers) {
        camsUserReferences.push({
          id: oktaUser.id,
          name:
            oktaUser.profile.displayName ??
            oktaUser.profile.lastName + ', ' + oktaUser.profile.firstName,
        });
      }
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: 'Failed to retrieve users.',
          module: MODULE_NAME,
        },
      });
    }
    return camsUserReferences;
  }

  async getUser(request: UserRequest): Promise<CamsUserReference> {
    try {
      const user = await this.client.userApi.getUser(request);
      return {
        id: user.id,
        name: user.profile.displayName ?? user.profile.lastName + ', ' + user.profile.firstName,
      };
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: 'Failed to retrieve user.',
          module: MODULE_NAME,
        },
      });
    }
  }

  async listUserGroups(request: UserGroupsRequest): Promise<IdpGroup[]> {
    const groups: IdpGroup[] = [];

    try {
      const oktaGroups = await this.client.userApi.listUserGroups(
        request as UserApiListUserGroupsRequest,
      );
      for await (const oktaGroup of oktaGroups) {
        groups.push({ id: oktaGroup.id, name: oktaGroup.profile.name });
      }
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: "Failed to retrieve user's groups.",
          module: MODULE_NAME,
        },
      });
    }

    return groups;
  }

  private async initialize(config: UserGroupGatewayConfig) {
    if (!this.client) {
      try {
        this.validateConfiguration(config);
        let clientConfig: V2Configuration;
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
        this.client = new Client(clientConfig);
      } catch (originalError) {
        throw isCamsError(originalError)
          ? originalError
          : new UnknownError(MODULE_NAME, { originalError, message: 'Failed to initialize.' });
      }
    }
  }

  private validateConfiguration(config: UserGroupGatewayConfig): void {
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
}

export default OktaHumble;
