import { getAuthorizationConfig } from '../../../configs/authorization-configuration';
import { OpenIdConnectGateway } from '../../types/authorization';
import { ServerConfigError } from '../../../common-errors/server-config-error';
import { UnauthorizedError } from '../../../common-errors/unauthorized-error';
import { verifyAccessToken } from './HumbleVerifier';
import { CamsUser } from '../../../../../common/src/cams/users';
import { CamsJwt } from '../../../../../common/src/cams/jwt';
import { isCamsError } from '../../../common-errors/cams-error';

const MODULE_NAME = 'OKTA-GATEWAY';

type OktaUserInfo = {
  sub: string;
  name: string;
  locale: string;
  email: string;
  preferred_username: string;
  given_name: string;
  family_name: string;
  zoneinfo: string;
  updated_at: number;
  email_verified: boolean;
};

async function verifyToken(token: string): Promise<CamsJwt> {
  const { issuer, audience, provider } = getAuthorizationConfig();
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
    const maybeCamsJwt = await verifyAccessToken(issuer, token, audience);
    if (!maybeCamsJwt.claims.groups) {
      throw new Error('Access token claims missing groups.');
    }
    return maybeCamsJwt as CamsJwt;
  } catch (originalError) {
    throw new UnauthorizedError(MODULE_NAME, { originalError });
  }
}

async function getUser(accessToken: string): Promise<{ user: CamsUser; jwt: CamsJwt }> {
  const { userInfoUri } = getAuthorizationConfig();

  try {
    const jwt = await verifyToken(accessToken);
    if (!jwt) {
      throw new UnauthorizedError(MODULE_NAME, {
        message: 'Unable to verify token.',
      });
    }

    const response = await fetch(userInfoUri, {
      method: 'GET',
      headers: { authorization: 'Bearer ' + accessToken },
    });

    if (response.ok) {
      const oktaUser = (await response.json()) as OktaUserInfo;
      const user: CamsUser = {
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

      return { user, jwt };
    } else {
      throw new Error('Failed to retrieve user info from Okta.');
    }
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
