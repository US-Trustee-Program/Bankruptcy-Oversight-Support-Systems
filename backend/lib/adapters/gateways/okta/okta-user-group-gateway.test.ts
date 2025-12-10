import { vi } from 'vitest';
import { CamsUser, CamsUserGroup, CamsUserReference } from '../../../../../common/src/cams/users';
import { UnknownError } from '../../../common-errors/unknown-error';
import { UserGroupGateway, UserGroupGatewayConfig } from '../../types/authorization';
import { ApplicationContext } from '../../types/basic';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { randomUUID } from 'node:crypto';
import { MockOfficesGateway } from '../../../testing/mock-gateways/mock.offices.gateway';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { UstpOfficeDetails } from '../../../../../common/src/cams/offices';
import OktaHumble, { IdpGroup } from '../../../humble-objects/okta-humble';
import OktaUserGroupGateway from './okta-user-group-gateway';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';

const configuration: UserGroupGatewayConfig = {
  provider: 'okta',
  url: 'http://somedomain/',
  clientId: 'clientId',
  privateKey: '{}', // pragma: allowlist secret
  keyId: 'keyId',
};

describe('OktaGroupGateway', () => {
  let gateway: UserGroupGateway;

  beforeEach(async () => {
    gateway = new OktaUserGroupGateway();
    vi.spyOn(OktaHumble.prototype, 'init').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // TODO: should we remove these?
  describe('bad configurations', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    test('wrong provider', async () => {
      const configCopy = { ...configuration };
      configCopy.provider = 'notOkta';
      await expect(gateway.init(configCopy)).rejects.toThrow(
        `Invalid provider. Expected 'okta'. Received '${configCopy.provider}'.`,
      );
    });

    test('missing parameters', async () => {
      const required: (keyof UserGroupGatewayConfig)[] = ['clientId', 'keyId', 'url', 'privateKey'];
      for (const key of required) {
        const configCopy = { ...configuration };
        configCopy[key] = null;
        await expect(gateway.init(configCopy)).rejects.toThrow(
          `Missing configuration. Expected '${key}'.'`,
        );
      }
    });
  });

  describe('getUserGroups', () => {
    const group1: IdpGroup = {
      id: 'foo1',
      name: 'cams group name #1',
    };

    const group2: IdpGroup = {
      id: 'foo2',
      name: 'cams group name #2',
    };

    const group3: IdpGroup = {
      id: 'foo3',
      name: 'cams group name #3',
    };

    let context: ApplicationContext;

    beforeEach(async () => {
      context = await createMockApplicationContext();
      await gateway.init(configuration);
    });

    test('should return a list of CamsUserGroups', async () => {
      vi.spyOn(OktaHumble.prototype, 'listGroups').mockResolvedValue([group1, group2, group3]);

      const actual = await gateway.getUserGroups(context);

      const expected: CamsUserGroup[] = [
        {
          id: group1.id,
          name: group1.name,
        },
        {
          id: group2.id,
          name: group2.name,
        },
        {
          id: group3.id,
          name: group3.name,
        },
      ];
      expect(actual).toEqual(expected);
    });

    test('should throw an error if an error is returned by the api', async () => {
      vi.spyOn(OktaHumble.prototype, 'listGroups').mockRejectedValue(
        new UnknownError('TEST-MODULE'),
      );

      await expect(gateway.getUserGroups(context)).rejects.toThrow();
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
      await gateway.init(configuration);
    });

    test('should return a list of CamsUsers', async () => {
      const user1: CamsUserReference = {
        id: '00123abc',
        name: 'Abe Lincoln',
      };

      const user2: CamsUserReference = {
        id: '99123abc',
        name: 'Lincoln, Mary',
      };

      vi.spyOn(OktaHumble.prototype, 'listGroupUsers').mockResolvedValue([user1, user2]);

      const actual = await gateway.getUserGroupUsers(context, camsUserGroup);

      const expected: CamsUserReference[] = [
        {
          id: user1.id,
          name: user1.name,
        },
        {
          id: user2.id,
          name: user2.name,
        },
      ];
      expect(actual).toEqual(expected);
    });

    test('should throw an error if an error is returned by the api', async () => {
      vi.spyOn(OktaHumble.prototype, 'listGroupUsers').mockRejectedValue(
        new UnknownError('TEST-MODULE'),
      );

      await expect(gateway.getUserGroupUsers(context, camsUserGroup)).rejects.toThrow();
    });
  });

  describe('getUserGroupWithUsers tests', () => {
    let context: ApplicationContext;

    beforeEach(async () => {
      context = await createMockApplicationContext();
      await gateway.init(configuration);
    });

    test('should return group with users', async () => {
      const group = {
        id: randomUUID(),
        name: 'Cams group name #1',
      };
      const users = MockData.buildArray(MockData.getCamsUserReference, 4);

      vi.spyOn(OktaHumble.prototype, 'listGroups').mockResolvedValue([group]);
      vi.spyOn(OktaHumble.prototype, 'listGroupUsers').mockResolvedValue(users);

      const result = await gateway.getUserGroupWithUsers(context, group.id);
      expect(result).toEqual({
        id: group.id,
        name: group.name,
        users,
      });
    });

    const errorCases = [
      ['0 groups found', [], 0],
      ['more than 1 groups found', MockData.buildArray(MockData.getCamsUserGroup, 4), 4],
    ];
    test.each(errorCases)(
      'should throw error when %s',
      async (_caseName: string, groups: CamsUserGroup[], count: number) => {
        vi.spyOn(OktaHumble.prototype, 'listGroups').mockResolvedValue(groups);
        const groupName = 'test-group';
        await expect(gateway.getUserGroupWithUsers(context, groupName)).rejects.toThrow(
          expect.objectContaining({
            message: `Found ${count} groups matching ${groupName}, expected 1.`,
            status: 500,
            module: 'OKTA-USER-GROUP-GATEWAY',
          }),
        );
      },
    );

    test('should throw UnknownError', async () => {
      vi.spyOn(OktaHumble.prototype, 'listGroups').mockRejectedValue('some unknown error');
      const groupName = 'test-group';
      await expect(gateway.getUserGroupWithUsers(context, groupName)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unknown Error',
          status: 500,
          module: 'OKTA-USER-GROUP-GATEWAY',
          originalError: expect.stringContaining('some unknown error'),
        }),
      );
    });
  });

  describe('getUserById tests', () => {
    let context: ApplicationContext;
    const manhattanOffice: UstpOfficeDetails = {
      officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
      officeName: 'Manhattan',
      groups: [],
      idpGroupName: 'USTP CAMS Region 2 Office Manhattan',
      regionId: '02',
      regionName: 'Region 2',
    };

    beforeEach(async () => {
      context = await createMockApplicationContext();
      await gateway.init(configuration);
    });

    test('should return user with roles and offices', async () => {
      const user: CamsUserReference = {
        id: '00123abc',
        name: 'Abe Lincoln',
      };
      const groupOne: IdpGroup = {
        id: randomUUID(),
        name: 'USTP CAMS Region 2 Office Manhattan',
      };
      const groupTwo: IdpGroup = {
        id: manhattanOffice.idpGroupName,
        name: 'USTP CAMS Trial Attorney',
      };
      vi.spyOn(MockOfficesGateway.prototype, 'getOffices').mockResolvedValue([manhattanOffice]);

      vi.spyOn(OktaHumble.prototype, 'getUser').mockResolvedValue(user);
      vi.spyOn(OktaHumble.prototype, 'listUserGroups').mockResolvedValue([groupOne, groupTwo]);

      const expected: CamsUser = {
        id: user.id,
        name: user.name,
        roles: [CamsRole.TrialAttorney],
        offices: [manhattanOffice],
      };
      const actual = await gateway.getUserById(context, user.id);
      expect(actual).toEqual(expected);
    });

    test('should throw error with CamsStack', async () => {
      vi.spyOn(OktaHumble.prototype, 'getUser').mockRejectedValue('some unknown error');
      await expect(gateway.getUserById(context, 'test-user')).rejects.toThrow(
        expect.objectContaining({
          message: 'Unknown Error',
          status: 500,
          module: 'OKTA-USER-GROUP-GATEWAY',
          originalError: expect.stringContaining('some unknown error'),
        }),
      );
    });
  });
});
