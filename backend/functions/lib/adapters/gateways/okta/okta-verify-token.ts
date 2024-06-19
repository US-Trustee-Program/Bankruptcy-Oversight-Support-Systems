import OktaJwtVerifier = require('@okta/jwt-verifier');
import { ForbiddenError } from '../../../common-errors/forbidden-error';
import { getAuthorizationConfig } from '../../../configs/authorization-configuration';

const MODULE_NAME = 'OKTA-GATEWAY';

let oktaJwtVerifier = null;

export async function oktaVerifyToken(token: string) {
  const { issuer, audience, provider } = getAuthorizationConfig();
  if (provider !== 'okta') {
    throw new ForbiddenError(MODULE_NAME, { message: 'Invalid provider.' });
  }
  if (!issuer) {
    throw new ForbiddenError(MODULE_NAME, { message: 'Issuer not provided.' });
  }
  if (!audience) {
    throw new ForbiddenError(MODULE_NAME, { message: 'Audience not provided.' });
  }
  try {
    if (!oktaJwtVerifier) {
      oktaJwtVerifier = new OktaJwtVerifier({ issuer });
    }
    return oktaJwtVerifier.verifyAccessToken(token, audience);
  } catch (originalError) {
    throw new ForbiddenError(MODULE_NAME, { originalError });
  }
}
