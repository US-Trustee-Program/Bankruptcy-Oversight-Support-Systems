import { getAuthorizationConfig } from '../../../configs/authorization-configuration';
import { Jwt, OpenIdConnectGateway } from '../../types/authorization';
import { CamsUser } from '../../../../../../common/src/cams/session';
import { ServerConfigError } from '../../../common-errors/server-config-error';
import { UnauthorizedError } from '../../../common-errors/unauthorized-error';
import { verifyAccessToken } from './HumbleVerifier';

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

async function verifyToken(token: string): Promise<Jwt> {
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
    return await verifyAccessToken(issuer, token, audience);
  } catch (originalError) {
    throw new UnauthorizedError(MODULE_NAME, { originalError });
  }
}

async function getUser(accessToken): Promise<CamsUser> {
  const { userInfoUri } = getAuthorizationConfig();

  try {
    // const response = await httpGet({
    //   url: userInfoUri,
    //   headers: { authorization: 'Bearer ' + accessToken },
    // });
    const response = await fetch(userInfoUri, {
      method: 'GET',
      headers: { authorization: 'Bearer ' + accessToken },
    });
    if (response.ok) {
      const userInfo = (await response.json()) as OktaUserInfo;
      const camsUser: CamsUser = {
        name: userInfo.name,
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
