import { Context } from '@azure/functions';
import { ApplicationContext } from '../types/basic';
import { ApplicationConfiguration } from '../../configs/application-configuration';
import { getFeatureFlags } from './feature-flag';
import { LoggerImpl } from '../services/logger.service';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { CamsSession } from '../../../../../common/src/cams/session';
import { CamsHttpRequest } from '../types/http';
import { oktaVerifyToken } from '../gateways/okta/okta-verify-token';

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

//////////////////////////////////////////////////////////////////////////////////////

function getProviderFromIssuer(issuer: string) {
  if (issuer.includes('okta.com')) return 'okta';
  return null;
}

export async function getSession(request: CamsHttpRequest) {
  const authorizationHeader = request.headers['authorization'];
  const match = authorizationHeader.match(/Bearer (.+)/);

  if (!match) {
    throw new ForbiddenError('AUTHORIZATION', {
      message: 'Bearer token not found in authorization header',
    });
  }

  const apiToken = match[1];
  if (!apiToken) {
    throw new ForbiddenError('AUTHORIZATION', {
      message: 'Unable to get token from authorization header',
    });
  }

  // TODO: We need to check the "cache" in Cosmos for the token. If it exists just return the CamsSession from Cosmos.

  // TODO: Get the issuer from a configuration rather than a module scoped variable.
  // TODO: Get this from the app configuration.
  const issuer = `https://dev-31938913.okta.com/oauth2/default`;
  const provider = getProviderFromIssuer(issuer);

  let verification = null;
  switch (provider) {
    case 'okta':
      verification = await oktaVerifyToken(apiToken);
      break;
    default:
      throw new ForbiddenError('AUTHORIZATION', {
        message: 'Authorization provider not supported.',
      });
  }

  if (!verification) {
    throw new ForbiddenError('AUTHORIZATION', {
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
