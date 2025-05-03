import { CamsJwt, isCamsJwt } from '../../../../../common/src/cams/jwt';
import { CamsUserReference } from '../../../../../common/src/cams/users';
import { isCamsError } from '../../../common-errors/cams-error';
import { ServerConfigError } from '../../../common-errors/server-config-error';
import { UnauthorizedError } from '../../../common-errors/unauthorized-error';
import { getAuthorizationConfig } from '../../../configs/authorization-configuration';
import { OpenIdConnectGateway } from '../../types/authorization';
import { verifyAccessToken } from './HumbleVerifier';

const MODULE_NAME = 'OKTA-GATEWAY';

type OktaJwtParseError = {
  innerError: {
    code: string;
    errno: number;
    syscall: string;
  };
  jwtString: string;
  message: string;
  name: string;
  parsedBody: Record<string, number | object | string>;
  parsedHeader: Record<string, number | object | string>;
  userMessage: string;
};

type OktaUserInfo = {
  email: string;
  email_verified: boolean;
  family_name: string;
  given_name: string;
  locale: string;
  name: string;
  preferred_username: string;
  sub: string;
  updated_at: number;
  zoneinfo: string;
};

async function getUser(accessToken: string): Promise<{ jwt: CamsJwt; user: CamsUserReference }> {
  const { userInfoUri } = getAuthorizationConfig();

  try {
    const jwt = await verifyToken(accessToken);

    const response = await fetch(userInfoUri, {
      headers: { authorization: 'Bearer ' + accessToken },
      method: 'GET',
    });

    if (response.ok) {
      const oktaUser = (await response.json()) as OktaUserInfo;
      const user: CamsUserReference = {
        id: oktaUser.sub,
        name: oktaUser.name,
      };

      // DOJ Login Okta instances return a custom `AD_Groups` attribute on claims that does not
      // appear on standard Okta claims. This line checks to see if it exists and if not
      // appends an empty array for groups that will carry no permissions for the user.

      const adGroups = Object.keys(jwt.claims).reduce((acc, key) => {
        if (key.toLowerCase() === 'ad_groups') {
          acc.push(jwt.claims[key]);
        }
        return acc;
      }, []);

      jwt.claims.groups = Array.from(
        new Set<string>([].concat(jwt.claims.groups ?? [], ...adGroups)),
      );

      return { jwt, user };
    } else {
      throw new Error('Failed to retrieve user info from Okta.');
    }
  } catch (originalError) {
    throw isCamsError(originalError)
      ? originalError
      : new UnauthorizedError(MODULE_NAME, { originalError });
  }
}

function isJwtParseError(maybe: unknown): maybe is OktaJwtParseError {
  return !!maybe && typeof maybe === 'object' && 'name' in maybe && maybe.name === 'JwtParseError';
}

async function verifyAccessTokenWithRetry(
  issuer: string,
  token: string,
  audience: string,
  retry = true,
): Promise<object> {
  try {
    return await verifyAccessToken(issuer, token, audience);
  } catch (originalError) {
    if (retry && isJwtParseError(originalError) && originalError.innerError.code === 'ECONNRESET') {
      return await verifyAccessToken(issuer, token, audience);
    }
    throw originalError;
  }
}

async function verifyToken(token: string): Promise<CamsJwt> {
  const { audience, issuer, provider } = getAuthorizationConfig();
  if (provider !== 'okta') {
    throw new ServerConfigError(MODULE_NAME, { message: 'Invalid provider.' });
  }
  if (!issuer) {
    throw new ServerConfigError(MODULE_NAME, { message: 'Issuer not provided.' });
  }
  if (!audience) {
    throw new ServerConfigError(MODULE_NAME, { message: 'Audience not provided.' });
  }
  try {
    const maybeCamsJwt = await verifyAccessTokenWithRetry(issuer, token, audience);
    if (!isCamsJwt(maybeCamsJwt)) {
      throw new UnauthorizedError(MODULE_NAME, {
        message: 'Unable to verify token.',
      });
    }
    if (!maybeCamsJwt.claims.groups) {
      throw new UnauthorizedError(MODULE_NAME, {
        message: 'Access token claims missing groups.',
      });
    }
    return maybeCamsJwt as CamsJwt;
  } catch (originalError) {
    throw isCamsError(originalError)
      ? originalError
      : new UnauthorizedError(MODULE_NAME, { originalError });
  }
}

const OktaGateway: OpenIdConnectGateway = {
  getUser,
};

export default OktaGateway;
