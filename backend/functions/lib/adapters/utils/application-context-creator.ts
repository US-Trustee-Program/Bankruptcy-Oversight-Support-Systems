import { Context } from '@azure/functions';
import { ApplicationContext } from '../types/basic';
import { ApplicationConfiguration } from '../../configs/application-configuration';
import { getFeatureFlags } from './feature-flag';
import { LoggerImpl } from '../services/logger.service';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { CamsSession } from '../../../../../common/src/cams/session';
import { CamsHttpRequest } from '../types/http';
import { oktaVerifyToken } from '../gateways/okta/okta-verify-token';
import { getAuthorizationConfig } from '../../configs/authorization-configuration';

const MODULE_NAME = 'APPLICATION-CONTEXT-CREATOR';

export async function applicationContextCreator(
  functionContext: Context,
): Promise<ApplicationContext> {
  const config = new ApplicationConfiguration();
  const featureFlags = await getFeatureFlags(config);
  const logger = new LoggerImpl(functionContext.log);

  return {
    ...functionContext,
    config,
    featureFlags,
    logger,
  } satisfies ApplicationContext;
}

export async function getApplicationContextSession(request: CamsHttpRequest) {
  const { provider } = getAuthorizationConfig();

  const authorizationHeader = request.headers['authorization'];
  const match = authorizationHeader.match(/Bearer (.+)/);

  if (!match) {
    throw new ForbiddenError(MODULE_NAME, {
      message: 'Bearer token not found in authorization header',
    });
  }

  const apiToken = match[1];
  if (!apiToken) {
    throw new ForbiddenError(MODULE_NAME, {
      message: 'Unable to get token from authorization header',
    });
  }

  // TODO: We need to check the "cache" in Cosmos for the token. If it exists just return the CamsSession from Cosmos.

  let verification = null;
  switch (provider) {
    case 'okta':
      verification = await oktaVerifyToken(apiToken);
      break;
    default:
      throw new ForbiddenError(MODULE_NAME, {
        message: 'Authorization provider not supported.',
      });
  }

  if (!verification) {
    throw new ForbiddenError(MODULE_NAME, {
      message: 'Unable to verify token.',
    });
  }

  // TODO: If we are here then we need to cache the CamsSession in Cosmos with an appropriate TTL calculated from the token expiration timestamp.

  // TODO: We need to call Okta to get the profile and email scopes.
  const session: CamsSession = {
    provider,
    user: {
      name: verification.name,
    },
    apiToken,
  };

  return session;
}
