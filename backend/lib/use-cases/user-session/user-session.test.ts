import { UserSessionUseCase } from './user-session';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockData } from '../../../../common/src/cams/test-utilities/mock-data';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import * as factoryModule from '../../factory';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { CamsSession, getCamsUserReference } from '../../../../common/src/cams/session';
import { CamsRole } from '../../../../common/src/cams/roles';
import { urlRegex } from '../../../../common/src/cams/test-utilities/regex';
import { CamsJwt, CamsJwtClaims, CamsJwtHeader } from '../../../../common/src/cams/jwt';
import MockOpenIdConnectGateway from '../../testing/mock-gateways/mock-oauth2-gateway';
import * as Verifier from '../../adapters/gateways/okta/HumbleVerifier';
import { REGION_02_GROUP_NY } from '../../../../common/src/cams/test-utilities/mock-user';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { NotFoundError } from '../../common-errors/not-found-error';
import { AugmentableUser } from '../../../../common/src/cams/users';
import { USTP_OFFICE_DATA_MAP } from '../../../../common/src/cams/offices';

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
  const provider = 'okta';
  const mockUser = MockData.getCamsUser();
  const expectedSession = MockData.getCamsSession({
    user: mockUser,
    accessToken: jwtString,
    provider,
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

  beforeEach(async () => {
    gateway = new UserSessionUseCase();
    context = await createMockApplicationContext({
      env: { CAMS_LOGIN_PROVIDER: 'okta', CAMS_LOGIN_PROVIDER_CONFIG: 'something' },
    });

    jest.spyOn(Verifier, 'verifyAccessToken').mockResolvedValue(camsJwt);
    jest
      .spyOn(MockOpenIdConnectGateway, 'getUser')
      .mockResolvedValue({ user: mockUser, jwt: camsJwt });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return valid session and add to cache when cache miss is encountered', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    const createSpy = jest
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(mockCamsSession);
    const session = await gateway.lookup(context, jwtString, provider);
    expect(session).toEqual({
      ...expectedSession,
      expires: expect.any(Number),
      issuer: expect.stringMatching(urlRegex),
    });
    expect(createSpy).toHaveBeenCalled();
  });

  test('should return valid session on cache hit', async () => {
    const expected = {
      ...expectedSession,
      expires: expect.any(Number),
      issuer: expect.stringMatching(urlRegex),
    };
    jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(expected);
    const createSpy = jest
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockRejectedValue('We should not call this function.');
    const session = await gateway.lookup(context, jwtString, provider);
    expect(session).toEqual(expected);
    expect(createSpy).not.toHaveBeenCalled();
  });

  test('should augment an augmentable user', async () => {
    const user = MockData.getCamsUser({ offices: [], roles: [] });

    const augmentedUser: AugmentableUser = {
      documentType: 'AUGMENTABLE_USER',
      ...getCamsUserReference(user),
      roles: [CamsRole.CaseAssignmentManager, CamsRole.DataVerifier, CamsRole.TrialAttorney],
      officeCodes: ['USTP_CAMS_Region_3_Office_Wilmington', 'USTP_CAMS_Region_2_Office_Buffalo'],
    };

    // set the AD groups the user belongs to in the JWT
    const jwtClaims: CamsJwtClaims = {
      ...claims,
      groups: [
        'USTP CAMS Augmentable User',
        'USTP CAMS Trial Attorney',
        'USTP CAMS Region 2 Office Manhattan',
        'USTP CAMS Region 2 Office Buffalo',
      ],
    };
    const jwt: CamsJwt = {
      header: jwtHeader,
      claims: jwtClaims,
    };

    const expectedSession: CamsSession = {
      user: { ...user },
      provider,
      accessToken: jwtString,
      expires: expect.any(Number),
      issuer: expect.stringMatching(urlRegex),
    };

    // should return a unique set of roles
    expectedSession.user.roles = [
      CamsRole.AugmentableUser,
      CamsRole.CaseAssignmentManager,
      CamsRole.DataVerifier,
      CamsRole.TrialAttorney,
    ];

    // should return a unique set of offices
    expectedSession.user.offices = [
      USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_2_Office_Manhattan'),
      USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_3_Office_Wilmington'),
      USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_2_Office_Buffalo'),
    ];

    // we don't want to pull the session from cache...
    jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));

    // get the user from the auth provider with the AD assigned roles and offices.
    jest.spyOn(MockOpenIdConnectGateway, 'getUser').mockResolvedValue({ user, jwt });

    // get the augmented user record to union in to the AD assigned roles and offices.
    const getAugmentableUserSpy = jest
      .spyOn(MockMongoRepository.prototype, 'getAugmentableUser')
      .mockResolvedValue(augmentedUser);

    // we want the session to be cached...
    const upsertSpy = jest
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(expectedSession);

    const session = await gateway.lookup(context, jwtString, provider);

    expect(session.user.roles).toEqual(expect.arrayContaining(expectedSession.user.roles));
    expect(session.user.roles.length).toEqual(expectedSession.user.roles.length);

    expect(session.user.offices).toEqual(expect.arrayContaining(expectedSession.user.offices));
    expect(session.user.offices.length).toEqual(expectedSession.user.offices.length);

    expect(upsertSpy).toHaveBeenCalled();
    expect(getAugmentableUserSpy).toHaveBeenCalled();
  });

  test('should return valid session and silently log augmentation error', async () => {
    const jwtClaims: CamsJwtClaims = {
      ...claims,
      groups: ['USTP CAMS Augmentable User'],
    };
    const jwt: CamsJwt = {
      header: jwtHeader,
      claims: jwtClaims,
    };
    jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    jest.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(mockCamsSession);
    jest.spyOn(MockOpenIdConnectGateway, 'getUser').mockResolvedValue({ user: mockUser, jwt });
    const errorMessage = 'some unknown error';
    jest
      .spyOn(MockMongoRepository.prototype, 'getAugmentableUser')
      .mockRejectedValue(new Error(errorMessage));
    const loggerSpy = jest.spyOn(context.logger, 'error');

    const session = await gateway.lookup(context, jwtString, provider);
    expect(session).toEqual({
      ...expectedSession,
      expires: expect.any(Number),
      issuer: expect.stringMatching(urlRegex),
    });
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.anything(),
      `Failed to augment user ${mockUser.name} (${mockUser.id}).`,
      errorMessage,
    );
  });

  test('should not add anything to cache if token is invalid', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    jest
      .spyOn(MockOpenIdConnectGateway, 'getUser')
      .mockRejectedValue(new UnauthorizedError('test-module'));
    const createSpy = jest.spyOn(MockMongoRepository.prototype, 'create');
    await expect(gateway.lookup(context, jwtString, provider)).rejects.toThrow();
    expect(createSpy).not.toHaveBeenCalled();
  });

  test('should handle null jwt from authGateway', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    jest.spyOn(MockOpenIdConnectGateway, 'getUser').mockResolvedValue({
      user: mockUser,
      jwt: null,
    });
    await expect(gateway.lookup(context, jwtString, provider)).rejects.toThrow(UnauthorizedError);
  });

  test('should handle undefined jwt from authGateway', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    jest.spyOn(MockOpenIdConnectGateway, 'getUser').mockResolvedValue({
      user: mockUser,
      jwt: undefined,
    });
    await expect(gateway.lookup(context, jwtString, provider)).rejects.toThrow(UnauthorizedError);
  });

  test('should throw UnauthorizedError if unknown error is encountered', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new UnauthorizedError(''));
    jest.spyOn(MockOpenIdConnectGateway, 'getUser').mockRejectedValue(new Error('Test error'));
    const createSpy = jest.spyOn(MockMongoRepository.prototype, 'create');
    await expect(gateway.lookup(context, jwtString, provider)).rejects.toThrow(UnauthorizedError);
    expect(createSpy).not.toHaveBeenCalled();
  });

  test('should throw ServerConfigError if factory does not return an OidcConnectGateway', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    jest.spyOn(factoryModule, 'getAuthorizationGateway').mockReturnValue(null);
    await expect(gateway.lookup(context, jwtString, provider)).rejects.toThrow(ServerConfigError);
  });

  // TODO: This should be removed once the feature flag logic is removed.
  test('should use legacy behavior if restrict-case-assignment feature flag is not set', async () => {
    jest.spyOn(factoryModule, 'getUserSessionCacheRepository').mockReturnValue({
      upsert: jest.fn(),
      read: jest.fn().mockRejectedValue(new NotFoundError('')),
      release: () => {},
    });

    jest.spyOn(factoryModule, 'getAuthorizationGateway').mockReturnValue(MockOpenIdConnectGateway);

    const localContext = { ...context, featureFlags: { ...context.featureFlags } };
    localContext.featureFlags['restrict-case-assignment'] = false;

    const session = await gateway.lookup(localContext, jwtString, provider);
    expect(session.user.offices).toEqual([REGION_02_GROUP_NY]);
    expect(session.user.roles).toEqual([CamsRole.CaseAssignmentManager]);
  });
});
