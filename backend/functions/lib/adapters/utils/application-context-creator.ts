import { Context } from '@azure/functions';
import { ApplicationContext } from '../types/basic';
import { ApplicationConfiguration } from '../../configs/application-configuration';
import { getFeatureFlags } from './feature-flag';
import { LoggerImpl } from '../services/logger.service';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { getAuthorizationConfig } from '../../configs/authorization-configuration';
import { getAuthorizationGateway, getUserSessionCacheRepository } from '../../factory';

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

export async function getApplicationContextSession(context: ApplicationContext) {
  const { provider } = getAuthorizationConfig();

  const authorizationHeader = context.req.headers['authorization'];
  const match = authorizationHeader.match(/Bearer (.+)/);

  if (!match) {
    throw new ForbiddenError(MODULE_NAME, {
      message: 'Bearer token not found in authorization header',
    });
  }

  const accessToken = match[1];
  if (!accessToken) {
    throw new ForbiddenError(MODULE_NAME, {
      message: 'Unable to get token from authorization header',
    });
  }

  const gateway = getAuthorizationGateway(provider);

  if (!gateway) {
    throw new ForbiddenError(MODULE_NAME, {
      message: 'Unsupported authentication provider.',
    });
  }

  // TODO: handle user before we store in cache
  const cache = getUserSessionCacheRepository(context);
  const session = await cache.get(context, accessToken);

  const jwt = await gateway.verifyToken(accessToken);
  session.user = await gateway.getUser(accessToken);

  if (!jwt) {
    throw new ForbiddenError(MODULE_NAME, {
      message: 'Unable to verify token.',
    });
  }

  // TODO: If we are here then we need to cache the CamsSession in Cosmos with an appropriate TTL calculated from the token expiration timestamp.

  // const session: CamsSession = {
  //   provider,
  //   user,
  //   apiToken: accessToken,
  //   validatedClaims: jwt.claims,
  // };

  return session;
}
