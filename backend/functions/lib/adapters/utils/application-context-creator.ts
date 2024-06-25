import { Context, HttpRequest } from '@azure/functions';
import { ApplicationContext } from '../types/basic';
import { ApplicationConfiguration } from '../../configs/application-configuration';
import { getFeatureFlags } from './feature-flag';
import { LoggerImpl } from '../services/logger.service';
import { getAuthorizationConfig } from '../../configs/authorization-configuration';
import { getAuthorizationGateway, getUserSessionGateway } from '../../factory';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { ServerConfigError } from '../../common-errors/server-config-error';

const MODULE_NAME = 'APPLICATION-CONTEXT-CREATOR';

export async function applicationContextCreator(
  functionContext: Context,
  request: HttpRequest,
): Promise<ApplicationContext> {
  const config = new ApplicationConfiguration();
  const featureFlags = await getFeatureFlags(config);
  const logger = new LoggerImpl(functionContext.invocationId, functionContext.log);

  return {
    ...functionContext,
    config,
    featureFlags,
    logger,
    req: { ...functionContext.req, ...request },
  } satisfies ApplicationContext;
}

export async function getApplicationContextSession(context: ApplicationContext) {
  const { provider } = getAuthorizationConfig();

  const authorizationHeader = context.req.headers['authorization'];

  if (!authorizationHeader) {
    throw new UnauthorizedError(MODULE_NAME, {
      message: 'Authorization header missing.',
    });
  }

  const match = authorizationHeader.match(/Bearer (.+)/);

  if (!match) {
    throw new UnauthorizedError(MODULE_NAME, {
      message: 'Bearer token not found in authorization header',
    });
  }

  const accessToken = match[1];
  if (!accessToken) {
    throw new UnauthorizedError(MODULE_NAME, {
      message: 'Unable to get token from authorization header',
    });
  }

  const gateway = getAuthorizationGateway(provider);

  if (!gateway) {
    throw new ServerConfigError(MODULE_NAME, {
      message: 'Unsupported authentication provider.',
    });
  }

  const sessionGateway = getUserSessionGateway(context);
  return await sessionGateway.lookup(context, accessToken, provider);
}
