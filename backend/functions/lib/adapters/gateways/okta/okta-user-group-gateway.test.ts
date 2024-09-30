import { Collection, Group, User } from '@okta/okta-sdk-nodejs';
import { CamsUserGroup, CamsUserReference } from '../../../../../../common/src/cams/users';
import { OktaUserGroupGateway } from './okta-user-group-gateway';
import { UnknownError } from '../../../common-errors/unknown-error';
import { UserGroupGatewayConfig } from '../../types/authorization';
import { ApplicationContext } from '../../types/basic';
import { createMockApplicationContext } from '../../../testing/testing-utilities';

const listGroups = jest.fn();
const listGroupUsers = jest.fn();
jest.mock('@okta/okta-sdk-nodejs', () => {
  return {
    Client: function () {
      return {
        groupApi: {
          listGroups,
          listGroupUsers,
        },
      };
    },
  };
});

const configuration: UserGroupGatewayConfig = {
  provider: 'okta',
  url: 'http://somedomain/',
  clientId: 'clientId',
  privateKey: '{}', // pragma: allowlist secret
  keyId: 'keyId',
};

describe('OktaGroupGateway', () => {
  describe('bad configurations', () => {
    test('wrong provider', async () => {
      const configCopy = { ...configuration };
      configCopy.provider = 'notOkta';
      await expect(OktaUserGroupGateway.initialize(configCopy)).rejects.toThrow(
        `Invalid provider. Expected 'okta'. Received '${configCopy.provider}'.`,
      );
    });

    test('missing parameters', async () => {
      const required: (keyof UserGroupGatewayConfig)[] = ['clientId', 'keyId', 'url', 'privateKey'];
      for (const key of required) {
        const configCopy = { ...configuration };
        configCopy[key] = null;
        await expect(OktaUserGroupGateway.initialize(configCopy)).rejects.toThrow(
          `Missing configuration. Expected '${key}'.'`,
        );
      }
    });

    // test('unknown error on initialization', async () => {
    //   // TODO: Must be able to mock the Client class from the Okta SDK
    //   // const testError = 'Test Error';
    //   // await expect(OktaUserGroupGateway.initialize(configuration)).rejects.toThrow(testError);
    // });
  });

  describe('getUserGroups', () => {
    const group1: Group = {
      id: 'foo1',
      profile: {
        name: 'cams group name #1',
      },
    };

    const group2: Group = {
      id: 'foo2',
      profile: {
        name: 'cams group name #2',
      },
    };

    const group3: Group = {
      id: 'foo3',
      profile: {
        name: 'cams group name #3',
      },
    };

    let context: ApplicationContext;

    beforeEach(async () => {
      context = await createMockApplicationContext();
    });

    test('should return a list of CamsUserGroups', async () => {
      listGroups.mockResolvedValue(buildMockCollection<Group>([group1, group2, group3]));

      const actual = await OktaUserGroupGateway.getUserGroups(context, configuration);

      const expected: CamsUserGroup[] = [
        {
          id: group1.id,
          name: group1.profile.name,
        },
        {
          id: group2.id,
          name: group2.profile.name,
        },
        {
          id: group3.id,
          name: group3.profile.name,
        },
      ];
      expect(actual).toEqual(expected);
    });

    test('should throw an error if an error is returned by the api', async () => {
      listGroups.mockRejectedValue(new UnknownError('TEST-MODULE'));

      await expect(OktaUserGroupGateway.getUserGroups(context, configuration)).rejects.toThrow();
    });
  });

  describe('getUserGroupMembership', () => {
    const camsUserGroup: CamsUserGroup = {
      id: 'foo',
      name: 'cams group name',
    };

    let context: ApplicationContext;

    beforeEach(async () => {
      context = await createMockApplicationContext();
    });

    test('should return a list of CamsUsers', async () => {
      const user1: User = {
        id: '00123abc',
        profile: {
          login: 'user@nodomain.com',
          displayName: 'Abe Lincoln',
        },
      };

      const user2: User = {
        id: '99123abc',
        profile: {
          login: 'user2@nodomain.com',
          firstName: 'Mary',
          lastName: 'Lincoln',
        },
      };

      listGroupUsers.mockResolvedValue(buildMockCollection<User>([user1, user2]));

      const actual = await OktaUserGroupGateway.getUserGroupUsers(
        context,
        configuration,
        camsUserGroup,
      );

      const expected: CamsUserReference[] = [
        {
          id: user1.profile.login,
          name: user1.profile.displayName,
        },
        {
          id: user2.profile.login,
          name: user2.profile.lastName + ', ' + user2.profile.firstName,
        },
      ];
      expect(actual).toEqual(expected);
    });

    test('should throw an error if an error is returned by the api', async () => {
      listGroupUsers.mockRejectedValue(new UnknownError('TEST-MODULE'));

      await expect(
        OktaUserGroupGateway.getUserGroupUsers(context, configuration, camsUserGroup),
      ).rejects.toThrow();
    });
  });
});

function buildMockCollection<T>(dataToReturn: T[]): Collection<T> {
  const currentItems = dataToReturn as unknown as Record<string, unknown>[];

  let index = 0;
  const collection: Collection<T> = {
    nextUri: '',
    httpApi: undefined,
    factory: undefined,
    currentItems,
    request: undefined,
    next: function (): Promise<{ done: boolean; value: T | null }> {
      const nextResponse = { done: index === currentItems.length, value: null };
      if (!nextResponse.done) {
        nextResponse.value = currentItems[index];
        index++;
      }
      return Promise.resolve(nextResponse);
    },
    getNextPage: function (): Promise<Record<string, unknown>[]> {
      throw new Error('Function not implemented.');
    },
    each: function (
      _iterator: (item: T) => Promise<unknown> | boolean | unknown,
    ): Promise<unknown> {
      throw new Error('Function not implemented.');
    },
    subscribe: function (_config: {
      interval?: number;
      next: (item: T) => unknown | Promise<unknown>;
      error: (e: Error) => unknown | Promise<unknown>;
      complete: () => void;
    }): { unsubscribe(): void } {
      throw new Error('Function not implemented.');
    },
    [Symbol.asyncIterator]: function (): {
      next: () => Promise<{ done: boolean; value: T | null }>;
    } {
      return { next: this.next };
    },
  };

  return collection;
}
