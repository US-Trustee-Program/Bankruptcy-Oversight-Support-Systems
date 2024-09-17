import { Collection, Group, User } from '@okta/okta-sdk-nodejs';
import { CamsUserGroup, CamsUserReference } from '../../../../../../common/src/cams/users';
import { OktaUserGroupGateway } from './okta-user-group-gateway';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { UnknownError } from '../../../common-errors/unknown-error';

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

describe('OktaGroupGateway', () => {
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

    test('should return a list of CamsUserGroups', async () => {
      listGroups.mockResolvedValue(buildMockCollection<Group>([group1, group2, group3]));

      const actual = await OktaUserGroupGateway.getUserGroups(await createMockApplicationContext());

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

      await expect(
        OktaUserGroupGateway.getUserGroups(await createMockApplicationContext()),
      ).rejects.toThrow();
    });
  });

  describe('getUserGroupMembership', () => {
    const camsUserGroup: CamsUserGroup = {
      id: 'foo',
      name: 'cams group name',
    };

    const user: User = {
      id: 'user@nodomain.com',
      profile: {
        displayName: 'Abe Lincoln',
      },
    };

    test('should return a list of CamsUsers', async () => {
      listGroupUsers.mockResolvedValue(buildMockCollection<User>([user]));

      const actual = await OktaUserGroupGateway.getUserGroupUsers(
        await createMockApplicationContext(),
        camsUserGroup,
      );

      const expected: CamsUserReference[] = [
        {
          id: user.id,
          name: user.profile.displayName,
        },
      ];
      expect(actual).toEqual(expected);
    });

    test('should throw an error if an error is returned by the api', async () => {
      listGroupUsers.mockRejectedValue(new UnknownError('TEST-MODULE'));

      await expect(
        OktaUserGroupGateway.getUserGroupUsers(await createMockApplicationContext(), camsUserGroup),
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
