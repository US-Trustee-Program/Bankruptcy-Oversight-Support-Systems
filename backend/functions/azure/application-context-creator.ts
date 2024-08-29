import * as jwt from 'jsonwebtoken';
import { InvocationContext, HttpRequest } from '@azure/functions';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { ApplicationConfiguration } from '../lib/configs/application-configuration';
import { getFeatureFlags } from '../lib/adapters/utils/feature-flag';
import { LoggerImpl } from '../lib/adapters/services/logger.service';
import { azureToCamsHttpRequest } from './functions';
import { UnauthorizedError } from '../lib/common-errors/unauthorized-error';
import { getUserSessionGateway } from '../lib/factory';
import { SessionGateway } from '../lib/adapters/utils/session-gateway';

const MODULE_NAME = 'APPLICATION-CONTEXT-CREATOR';

async function applicationContextCreator(
  invocationContext: InvocationContext,
  request?: HttpRequest,
): Promise<ApplicationContext> {
  const config = new ApplicationConfiguration();
  const featureFlags = await getFeatureFlags(config);

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const logWrapper: Console['log'] = (...args: any[]) => {
    invocationContext.log(args);
  };

  const logger = new LoggerImpl(invocationContext.invocationId, logWrapper);
  const context = {
    config,
    featureFlags,
    logger,
    invocationId: invocationContext.invocationId,
    request: request ? await azureToCamsHttpRequest(request) : undefined,
    session: undefined,
  } satisfies ApplicationContext;

  context.session = await getApplicationContextSession(context);

  return context;
}

async function getApplicationContextSession(context: ApplicationContext) {
  const authorizationHeader = context.request?.headers['authorization'];

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

  const sessionGateway: SessionGateway = getUserSessionGateway(context);
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
