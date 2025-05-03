import { Client, GroupApiListGroupsRequest, OktaApiError } from '@okta/okta-sdk-nodejs';
import { V2Configuration } from '@okta/okta-sdk-nodejs/src/types/configuration';
import { RequiredError } from '@okta/okta-sdk-nodejs/src/types/generated/apis/baseapi';
import { UserApiListUserGroupsRequest } from '@okta/okta-sdk-nodejs/src/types/generated/types/ObjectParamAPI';

import { CamsUserGroup, CamsUserReference } from '../../../common/src/cams/users';
import { UserGroupGatewayConfig } from '../adapters/types/authorization';
import { isCamsError } from '../common-errors/cams-error';
import { ServerConfigError } from '../common-errors/server-config-error';
import { UnauthorizedError } from '../common-errors/unauthorized-error';
import { UnknownError } from '../common-errors/unknown-error';

const MODULE_NAME = 'OKTA-HUMBLE';

export type IdpGroup = {
  id: string;
  name: string;
};

export type ListGroupsRequest = {
  limit?: number;
  query?: string;
};

export type ListGroupUsersRequest = {
  groupId: string;
  limit?: number;
};

export type UserGroupsRequest = {
  userId: string;
};

export type UserRequest = {
  userId: string;
};

export class OktaHumble {
  private client: Client;

  async getUser(request: UserRequest): Promise<CamsUserReference> {
    try {
      const user = await this.client.userApi.getUser(request);
      return {
        id: user.id,
        name: user.profile.displayName ?? user.profile.lastName + ', ' + user.profile.firstName,
      };
    } catch (originalError) {
      if (isOktaApiError(originalError) && originalError.status === 401) {
        throw new UnauthorizedError(MODULE_NAME, {
          message: 'Unauthorized error occurred while accessing Okta User API.',
          originalError,
        });
      } else {
        throw new UnknownError(MODULE_NAME, {
          message: 'Failed to retrieve user.',
          originalError: buildSerializableError(originalError),
        });
      }
    }
  }

  public async init(config: UserGroupGatewayConfig): Promise<void> {
    return await this.initialize(config);
  }

  async listGroups(request: ListGroupsRequest): Promise<CamsUserGroup[]> {
    const camsUserGroups: CamsUserGroup[] = [];
    try {
      const oktaRequest: GroupApiListGroupsRequest = {
        limit: request.limit,
        q: request.query,
      };
      const oktaGroups = await this.client.groupApi.listGroups(oktaRequest);

      for await (const oktaGroup of oktaGroups) {
        camsUserGroups.push({
          id: oktaGroup.id,
          name: oktaGroup.profile.name,
        });
      }
    } catch (originalError) {
      throw new UnknownError(MODULE_NAME, {
        message: 'Failed to retrieve groups.',
        originalError: buildSerializableError(originalError),
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
      throw new UnknownError(MODULE_NAME, {
        message: 'Failed to retrieve users.',
        originalError: buildSerializableError(originalError),
      });
    }
    return camsUserReferences;
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
      throw new UnknownError(MODULE_NAME, {
        message: "Failed to retrieve user's groups.",
        originalError: buildSerializableError(originalError),
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
            authorizationMode: 'SSWS',
            orgUrl: config.url,
            token: config.token,
          };
        } else {
          clientConfig = {
            authorizationMode: 'PrivateKey',
            clientId: config.clientId,
            keyId: config.keyId,
            orgUrl: config.url,
            privateKey: JSON.parse(config.privateKey),
            scopes: ['okta.groups.read'],
          };
        }
        this.client = new Client(clientConfig);
      } catch (originalError) {
        throw isCamsError(originalError)
          ? originalError
          : new UnknownError(MODULE_NAME, {
              message: 'Failed to initialize.',
              originalError: buildSerializableError(originalError),
            });
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

function buildSerializableError(originalError: Error) {
  if (isOktaRequiredError(originalError)) {
    return copyOktaError(originalError, ['api', 'message', 'method', 'field', 'name', 'stack']);
  }
  if (isOktaApiError(originalError)) {
    return copyOktaError(originalError, [
      'errorCode',
      'errorId',
      'errorLink',
      'errorSummary',
      'headers',
      'message',
      'name',
      'stack',
      'status',
      'url',
      'errorCauses',
    ]);
  }
  return originalError;
}

function copyOktaError(error: object, keys: string[]) {
  return keys.reduce(
    (acc, key) => {
      if (key in error) {
        acc[key] = error[key];
      }
      return acc;
    },
    { message: 'UNKNOWN', name: 'UNKNOWN' },
  );
}

function isOktaApiError(err: unknown): err is OktaApiError {
  return typeof err === 'object' && 'name' in err && 'errorSummary' in err;
}

function isOktaRequiredError(err: unknown): err is RequiredError {
  return typeof err === 'object' && 'name' in err && err.name === 'RequiredError';
}

export default OktaHumble;
