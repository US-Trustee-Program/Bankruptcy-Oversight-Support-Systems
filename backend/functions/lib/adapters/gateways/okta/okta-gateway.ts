import { getAuthorizationConfig } from '../../../configs/authorization-configuration';
import { CamsJwt, OpenIdConnectGateway } from '../../types/authorization';
import { ServerConfigError } from '../../../common-errors/server-config-error';
import { UnauthorizedError } from '../../../common-errors/unauthorized-error';
import { verifyAccessToken } from './HumbleVerifier';
import { CamsUser } from '../../../../../../common/src/cams/users';

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

async function getUser(accessToken: string): Promise<CamsUser> {
  const { userInfoUri } = getAuthorizationConfig();

  try {
    const response = await fetch(userInfoUri, {
      method: 'GET',
      headers: { authorization: 'Bearer ' + accessToken },
    });

    if (response.ok) {
      const oktaUser = (await response.json()) as OktaUserInfo;
      // TODO: We need to decide on the claim we will map to CamsUser.id
      const camsUser: CamsUser = {
        id: oktaUser.sub,
        name: oktaUser.name,
      };

      return camsUser;
    } else {
      throw new Error('Failed to retrieve user info from Okta.');
    }
  } catch (originalError) {
    throw new UnauthorizedError(MODULE_NAME, { originalError });
  }
}

const OktaGateway: OpenIdConnectGateway = {
  verifyToken,
  getUser,
};

export default OktaGateway;
