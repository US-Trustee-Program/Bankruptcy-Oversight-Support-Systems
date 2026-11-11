import { vi, MockInstance } from 'vitest';
import { UserSessionUseCase } from './user-session';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import MockData from '@common/cams/test-utilities/mock-data';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import factory from '../../factory';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { CamsSession } from '@common/cams/session';
import { urlRegex } from '@common/cams/test-utilities/regex';
import { CamsJwtHeader } from '@common/cams/jwt';
import MockOpenIdConnectGateway from '../../testing/mock-gateways/mock-oauth2-gateway';
import * as Verifier from '../../adapters/gateways/okta/HumbleVerifier';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { NotFoundError } from '../../common-errors/not-found-error';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { GatewayTimeoutError } from '../../common-errors/gateway-timeout';
import * as delayModule from '@common/delay';
import { MockOfficesGateway } from '../../testing/mock-gateways/mock.offices.gateway';
import { CamsRole } from '@common/cams/roles';
import { UsersRepository } from '../gateways.types';
import { MOCKED_USTP_OFFICES_ARRAY } from '@common/cams/test-utilities/offices.mock';
import { UserRoleAssignment } from '@common/cams/user-access';

describe('user-session.gateway test', () => {
  const jwtString = MockData.getJwt();
  const claims = {
    iss: 'https://nonsense-3wjj23473kdwh2.okta.com/oauth2/default',
    sub: 'user@fake.com',
    aud: 'api://default',
    iat: 0,
    exp: Number.MAX_SAFE_INTEGER,
    groups: [],
  };
  const provider = 'mock';
  const mockUser = MockData.getCamsUserReference();
  const expectedSession = MockData.getCamsSession({
    user: {
      ...mockUser,
      offices: [],
      roles: [],
    },
    accessToken: jwtString,
    provider: expect.any(String),
  });

  const mockCamsSession: CamsSession = {
    user: { id: 'userId-Wrong Name', name: 'Wrong Name' },
    accessToken: jwtString,
    provider,
    issuer: 'http://issuer/',
    expires: Number.MAX_SAFE_INTEGER,
  };
  let context: ApplicationContext;
  let gateway: UserSessionUseCase;

  const jwtHeader = {
    alg: 'RS256',
    typ: undefined,
    kid: '',
  };
  const camsJwt = {
    claims,
    header: jwtHeader as CamsJwtHeader,
  };
  let getUserSpy: MockInstance<(typeof MockOpenIdConnectGateway)['getUser']>;

  beforeEach(async () => {
    context = await createMockApplicationContext({
      env: { CAMS_LOGIN_PROVIDER: provider, CAMS_LOGIN_PROVIDER_CONFIG: 'something' },
    });
    context.featureFlags['privileged-identity-management'] = true;
    // These tests cover sessions built from AD groups; the flag-on path is tested below.
    context.featureFlags['cams-role-assignments'] = false;
    gateway = new UserSessionUseCase(context);

    vi.spyOn(Verifier, 'verifyAccessToken').mockResolvedValue(camsJwt);
    getUserSpy = vi.spyOn(MockOpenIdConnectGateway, 'getUser');
    vi.spyOn(delayModule, 'delay').mockResolvedValue(undefined);

    // Mock gateway layer - offices gateway returns mock offices
    vi.spyOn(factory, 'getOfficesGateway').mockReturnValue(new MockOfficesGateway());

    // Mock PIM repository to return NotFoundError (no privileged identity)
    const mockUsersRepository: Partial<UsersRepository> = {
      getPrivilegedIdentityUser: vi.fn().mockRejectedValue(new NotFoundError('No PIM record')),
    };
    vi.spyOn(factory, 'getUsersRepository').mockReturnValue(mockUsersRepository as UsersRepository);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return valid session and add to cache when cache miss is encountered', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    getUserSpy.mockResolvedValue({ user: mockUser, jwt: camsJwt });
    const createSpy = vi
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(mockCamsSession);
    const session = await gateway.lookup(context, jwtString);
    expect(session).toEqual({
      ...expectedSession,
      expires: expect.any(Number),
      issuer: expect.stringMatching(urlRegex),
    });
    expect(createSpy).toHaveBeenCalled();
    expect(getUserSpy).toHaveBeenCalledTimes(1);
  });

  test('should return valid session on cache hit', async () => {
    const expected = {
      ...expectedSession,
      expires: expect.any(Number),
      issuer: expect.stringMatching(urlRegex),
    };
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(expected);
    const createSpy = vi
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockRejectedValue('We should not call this function.');
    const session = await gateway.lookup(context, jwtString);
    expect(session).toEqual(expected);
    expect(createSpy).not.toHaveBeenCalled();
  });

  test('should not add anything to cache if token is invalid', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    getUserSpy.mockRejectedValue(new UnauthorizedError('test-module'));
    const createSpy = vi.spyOn(MockMongoRepository.prototype, 'create');
    await expect(gateway.lookup(context, jwtString)).rejects.toThrow();
    expect(createSpy).not.toHaveBeenCalled();
    expect(getUserSpy).toHaveBeenCalledTimes(3);
    expect(delayModule.delay).toHaveBeenCalledTimes(2);
  });

  test('should handle null jwt from authGateway', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    getUserSpy.mockResolvedValue({ user: mockUser, jwt: null });
    await expect(gateway.lookup(context, jwtString)).rejects.toThrow(UnauthorizedError);
  });

  test('should handle undefined jwt from authGateway', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    getUserSpy.mockResolvedValue({ user: mockUser, jwt: undefined });
    await expect(gateway.lookup(context, jwtString)).rejects.toThrow(UnauthorizedError);
  });

  test('should throw UnauthorizedError if unknown error is encountered', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new UnauthorizedError(''));
    getUserSpy.mockRejectedValue(new Error('Test error'));
    const createSpy = vi.spyOn(MockMongoRepository.prototype, 'create');
    await expect(gateway.lookup(context, jwtString)).rejects.toThrow(UnauthorizedError);
    expect(createSpy).not.toHaveBeenCalled();
  });

  test('should throw ServerConfigError if factory does not return an OidcConnectGateway', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    vi.spyOn(factory, 'getAuthorizationGateway').mockReturnValue(null);
    await expect(gateway.lookup(context, jwtString)).rejects.toThrow(ServerConfigError);
  });

  test('should retry identity provider call and succeed after transient failures', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    getUserSpy
      .mockRejectedValueOnce(new UnauthorizedError('Transient error 1'))
      .mockRejectedValueOnce(new UnauthorizedError('Transient error 2'))
      .mockResolvedValue({ user: mockUser, jwt: camsJwt });
    const upsertSpy = vi
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(mockCamsSession);

    const session = await gateway.lookup(context, jwtString);
    expect(session).toEqual({
      ...expectedSession,
      expires: expect.any(Number),
      issuer: expect.stringMatching(urlRegex),
    });
    expect(getUserSpy).toHaveBeenCalledTimes(3);
    expect(delayModule.delay).toHaveBeenCalledTimes(2);
    expect(delayModule.delay).toHaveBeenNthCalledWith(1, 2000);
    expect(delayModule.delay).toHaveBeenNthCalledWith(2, 4000);
    expect(upsertSpy).toHaveBeenCalled();
  });

  test('should throw after max retries from identity provider', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    getUserSpy.mockImplementation(() => {
      throw new UnauthorizedError('Persistent error');
    });
    await expect(gateway.lookup(context, jwtString)).rejects.toThrow(UnauthorizedError);
    expect(getUserSpy).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    expect(delayModule.delay).toHaveBeenCalledTimes(2);
    expect(delayModule.delay).toHaveBeenNthCalledWith(1, 2000);
    expect(delayModule.delay).toHaveBeenNthCalledWith(2, 4000);
  });

  test('should extract offices and roles from JWT groups', async () => {
    const jwtGroups = ['USTP CAMS Region 2 Office Buffalo', 'USTP CAMS Case Assignment Manager'];
    const jwtWithGroups = {
      ...camsJwt,
      claims: { ...claims, groups: jwtGroups },
    };

    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    getUserSpy.mockResolvedValue({ user: mockUser, jwt: jwtWithGroups });
    const upsertSpy = vi
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(mockCamsSession);

    const session = await gateway.lookup(context, jwtString);

    // Verify offices were extracted from JWT groups (MockOfficesGateway contains this office)
    expect(session.user.offices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          idpGroupName: 'USTP CAMS Region 2 Office Buffalo',
        }),
      ]),
    );

    // Verify roles were extracted from JWT groups (LocalStorageGateway maps this role)
    expect(session.user.roles).toContain(CamsRole.CaseAssignmentManager);

    expect(upsertSpy).toHaveBeenCalled();
    expect(getUserSpy).toHaveBeenCalledTimes(1);
  });

  test('should handle empty JWT groups', async () => {
    const jwtWithEmptyGroups = {
      ...camsJwt,
      claims: { ...claims, groups: [] },
    };

    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    getUserSpy.mockResolvedValue({ user: mockUser, jwt: jwtWithEmptyGroups });
    const upsertSpy = vi
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(mockCamsSession);

    const session = await gateway.lookup(context, jwtString);

    // With no groups, should have no offices or roles
    expect(session.user.offices).toEqual([]);
    expect(session.user.roles).toEqual([]);

    expect(upsertSpy).toHaveBeenCalled();
  });

  test('should handle JWT groups with roles but no matching offices', async () => {
    const jwtGroups = ['USTP CAMS Trial Attorney', 'NonExistentOfficeGroup'];
    const jwtWithGroups = {
      ...camsJwt,
      claims: { ...claims, groups: jwtGroups },
    };

    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    getUserSpy.mockResolvedValue({ user: mockUser, jwt: jwtWithGroups });
    const upsertSpy = vi
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(mockCamsSession);

    const session = await gateway.lookup(context, jwtString);

    // Should extract role even if no offices match
    expect(session.user.roles).toContain(CamsRole.TrialAttorney);
    // No offices should match the groups
    expect(session.user.offices).toEqual([]);

    expect(upsertSpy).toHaveBeenCalled();
  });

  describe('with cams-role-assignments on', () => {
    const MANHATTAN = MOCKED_USTP_OFFICES_ARRAY.find(
      (office) => office.officeCode === 'USTP_CAMS_Region_2_Office_Manhattan',
    )!;
    const manhattanTrialAttorney: UserRoleAssignment = {
      documentType: 'USER_ROLE_ASSIGNMENT',
      id: 'assignment-1',
      userId: mockUser.id,
      userName: mockUser.name,
      role: CamsRole.TrialAttorney,
      regionId: MANHATTAN.regionId,
      officeCode: MANHATTAN.officeCode,
      assignedBy: 'super-1',
      assignedByName: 'Super User',
      assignedAt: '2026-11-09T00:00:00.000Z',
      expiresAt: null,
      active: true,
      activeKey: `TrialAttorney|${MANHATTAN.regionId}|${MANHATTAN.officeCode}`,
    };
    // AD groups that would grant a different role and office if they were still used.
    const adGroups = ['USTP CAMS Region 2 Office Buffalo', 'USTP CAMS Case Assignment Manager'];

    beforeEach(() => {
      context.featureFlags['cams-role-assignments'] = true;
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
      getUserSpy.mockResolvedValue({
        user: mockUser,
        jwt: { ...camsJwt, claims: { ...claims, groups: adGroups } },
      });
    });

    test("should take roles and offices from the user's active permissions, not AD groups", async () => {
      const findSpy = vi
        .spyOn(MockMongoRepository.prototype, 'findActiveByUserIds')
        .mockResolvedValue([manhattanTrialAttorney]);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue(mockCamsSession);

      const session = await gateway.lookup(context, jwtString);

      expect(findSpy).toHaveBeenCalledWith([mockUser.id]);
      expect(session.user.roles).toEqual([CamsRole.TrialAttorney]);
      expect(session.user.offices.map((office) => office.officeCode)).toEqual([
        MANHATTAN.officeCode,
      ]);
      expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({ user: session.user }));
    });

    test('should give a user without permissions no roles or offices', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findActiveByUserIds').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(mockCamsSession);

      const session = await gateway.lookup(context, jwtString);

      expect(session.user.roles).toEqual([]);
      expect(session.user.offices).toEqual([]);
    });

    test('should still layer Privileged Identity on top', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findActiveByUserIds').mockResolvedValue([
        manhattanTrialAttorney,
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(mockCamsSession);
      const elevation = {
        documentType: 'PRIVILEGED_IDENTITY_USER',
        id: mockUser.id,
        userId: mockUser.id,
        name: mockUser.name,
        claims: { groups: ['USTP CAMS Case Assignment Manager', MANHATTAN.idpGroupName] },
        expires: '2999-01-01T00:00:00.000Z',
      };
      vi.spyOn(factory, 'getUsersRepository').mockReturnValue({
        getPrivilegedIdentityUser: vi.fn().mockResolvedValue(elevation),
      } as unknown as UsersRepository);

      const session = await gateway.lookup(context, jwtString);

      expect(session.user.roles).toEqual([CamsRole.TrialAttorney, CamsRole.CaseAssignmentManager]);
      expect(session.user.offices.map((office) => office.officeCode)).toEqual([
        MANHATTAN.officeCode,
      ]);
    });

    test('should deny the session, cache nothing and log a non-transient read failure once', async () => {
      const findSpy = vi
        .spyOn(MockMongoRepository.prototype, 'findActiveByUserIds')
        .mockRejectedValue(new Error('cosmos unavailable'));
      const upsertSpy = vi.spyOn(MockMongoRepository.prototype, 'upsert');
      const errorSpy = vi.spyOn(context.logger, 'error');
      const delaySpy = vi.spyOn(delayModule, 'delay');

      await expect(gateway.lookup(context, jwtString)).rejects.toThrow(UnauthorizedError);

      expect(findSpy).toHaveBeenCalledTimes(1);
      expect(delaySpy).not.toHaveBeenCalled();
      expect(upsertSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith('USER-SESSION-GATEWAY', 'SESSION_ACCESS read failed', {
        userId: mockUser.id,
        errorType: 'Error',
        status: undefined,
        module: undefined,
        message: 'cosmos unavailable',
        transient: false,
      });
    });

    test('should retry a transient read failure and build the session on success', async () => {
      const findSpy = vi
        .spyOn(MockMongoRepository.prototype, 'findActiveByUserIds')
        .mockRejectedValueOnce(new TooManyRequestsError('TEST'))
        .mockResolvedValueOnce([manhattanTrialAttorney]);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(mockCamsSession);
      const delaySpy = vi.spyOn(delayModule, 'delay').mockResolvedValue(undefined);
      const warnSpy = vi.spyOn(context.logger, 'warn');

      const session = await gateway.lookup(context, jwtString);

      expect(findSpy).toHaveBeenCalledTimes(2);
      expect(delaySpy).toHaveBeenCalledWith(250);
      expect(warnSpy).toHaveBeenCalledWith(
        'USER-SESSION-GATEWAY',
        'SESSION_ACCESS read retry 1/3',
        {
          userId: mockUser.id,
          errorType: 'TooManyRequestsError',
          status: 429,
          module: 'TEST',
        },
      );
      expect(session.user.roles).toEqual([CamsRole.TrialAttorney]);
    });

    test('should give up after three transient failures, back off between attempts, and cache nothing', async () => {
      const findSpy = vi
        .spyOn(MockMongoRepository.prototype, 'findActiveByUserIds')
        .mockRejectedValue(new GatewayTimeoutError('TEST'));
      const upsertSpy = vi.spyOn(MockMongoRepository.prototype, 'upsert');
      const delaySpy = vi.spyOn(delayModule, 'delay').mockResolvedValue(undefined);
      const errorSpy = vi.spyOn(context.logger, 'error');

      await expect(gateway.lookup(context, jwtString)).rejects.toThrow(GatewayTimeoutError);

      expect(findSpy).toHaveBeenCalledTimes(3);
      expect(delaySpy.mock.calls.map(([ms]) => ms)).toEqual([250, 500]);
      expect(upsertSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith('USER-SESSION-GATEWAY', 'SESSION_ACCESS read failed', {
        userId: mockUser.id,
        errorType: 'GatewayTimeoutError',
        status: 504,
        module: 'TEST',
        message: 'Gateway Timeout',
        transient: true,
      });
    });

    test('should log the access read from assignments at info', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findActiveByUserIds').mockResolvedValue([
        manhattanTrialAttorney,
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(mockCamsSession);
      const infoSpy = vi.spyOn(context.logger, 'info');
      const warnSpy = vi.spyOn(context.logger, 'warn');

      await gateway.lookup(context, jwtString);

      expect(infoSpy).toHaveBeenCalledWith(
        'USER-SESSION-GATEWAY',
        'Session access from assignments',
        {
          userId: mockUser.id,
          permissionCount: 1,
          roleCount: 1,
          officeCount: 1,
        },
      );
      expect(warnSpy).not.toHaveBeenCalledWith(
        'USER-SESSION-GATEWAY',
        'SESSION_NO_PERMISSIONS',
        expect.anything(),
      );
    });

    test('should warn SESSION_NO_PERMISSIONS with the JWT group count when the user has no permissions', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findActiveByUserIds').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(mockCamsSession);
      const warnSpy = vi.spyOn(context.logger, 'warn');

      await gateway.lookup(context, jwtString);

      expect(warnSpy).toHaveBeenCalledWith('USER-SESSION-GATEWAY', 'SESSION_NO_PERMISSIONS', {
        userId: mockUser.id,
        jwtGroupCount: adGroups.length,
      });
    });

    test('should log the session without the user name or the access source', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findActiveByUserIds').mockResolvedValue([
        manhattanTrialAttorney,
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(mockCamsSession);
      const debugSpy = vi.spyOn(context.logger, 'debug');

      await gateway.lookup(context, jwtString);

      const creating = debugSpy.mock.calls.find(([, message]) =>
        String(message).startsWith('Creating session with'),
      );
      expect(String(creating?.[1])).not.toContain(mockUser.name);
      expect(creating?.[2]).toEqual({
        userId: mockUser.id,
        jwtGroupCount: adGroups.length,
        officeCount: 1,
        roleCount: 1,
      });
    });

    test('should not read permissions when the flag is off', async () => {
      context.featureFlags['cams-role-assignments'] = false;
      const findSpy = vi.spyOn(MockMongoRepository.prototype, 'findActiveByUserIds');
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(mockCamsSession);

      await gateway.lookup(context, jwtString);

      expect(findSpy).not.toHaveBeenCalled();
    });
  });
});
