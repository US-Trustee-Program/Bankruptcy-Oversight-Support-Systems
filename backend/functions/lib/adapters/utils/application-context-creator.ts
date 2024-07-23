import { Context, HttpRequest } from '@azure/functions';
import { ApplicationContext } from '../types/basic';
import { ApplicationConfiguration } from '../../configs/application-configuration';
import { getFeatureFlags } from './feature-flag';
import { LoggerImpl } from '../services/logger.service';
import { getUserSessionGateway } from '../../factory';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { SessionCache } from './sessionCache';
import * as jwt from 'jsonwebtoken';

const MODULE_NAME = 'APPLICATION-CONTEXT-CREATOR';

async function applicationContextCreator(
  functionContext: Context,
  request: HttpRequest,
): Promise<ApplicationContext> {
  console.log('applicationContextCreator', request.headers['authorization']);
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

async function getApplicationContextSession(context: ApplicationContext) {
  const authorizationHeader = context.req.headers['authorization'];

  if (!authorizationHeader) {
    throw new UnauthorizedError(MODULE_NAME, {
      message: 'Authorization header missing.',
    });
  }

  const match = authorizationHeader.match(/Bearer (.+)/);

  if (!match || match.length !== 2) {
    throw new UnauthorizedError(MODULE_NAME, {
      message: 'Bearer token not found in authorization header',
    });
  }

  let accessToken = '';
  const jwtToken = jwt.decode(match[1]);
  if (jwtToken) {
    accessToken = match[1];
  } else {
    throw new UnauthorizedError(MODULE_NAME, {
      message: 'Malformed Bearer token in authorization header',
    });
  }

  const sessionGateway: SessionCache = getUserSessionGateway(context);
  const session = await sessionGateway.lookup(
    context,
    accessToken,
    context.config.authConfig.provider,
  );
  return session;
}

const ContextCreator = {
  applicationContextCreator,
  getApplicationContextSession,
};

export default ContextCreator;
