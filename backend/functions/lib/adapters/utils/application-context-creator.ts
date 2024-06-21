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

  const cache = getUserSessionCacheRepository(context);
  return await cache.get(context, accessToken);
}
