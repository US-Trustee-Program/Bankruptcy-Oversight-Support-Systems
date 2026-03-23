import { vi } from 'vitest';
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
import * as delayModule from '@common/delay';
import { MockOfficesGateway } from '../../testing/mock-gateways/mock.offices.gateway';
import { CamsRole } from '@common/cams/roles';
import { UsersRepository } from '../gateways.types';

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
  let getUserSpy: vi.SpiedFunction<(typeof MockOpenIdConnectGateway)['getUser']>;

  beforeEach(async () => {
    context = await createMockApplicationContext({
      env: { CAMS_LOGIN_PROVIDER: provider, CAMS_LOGIN_PROVIDER_CONFIG: 'something' },
    });
    context.featureFlags['privileged-identity-management'] = true;
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
});
