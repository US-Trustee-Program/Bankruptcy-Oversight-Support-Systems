import { InvocationContext, HttpRequest } from '@azure/functions';
import { ApplicationContext } from '../types/basic';
import { ApplicationConfiguration } from '../../configs/application-configuration';
import { getFeatureFlags } from './feature-flag';
import { LoggerImpl } from '../services/logger.service';
import { getUserSessionGateway } from '../../factory';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { SessionGateway } from './session-gateway';
import * as jwt from 'jsonwebtoken';
import { httpRequestToCamsHttpRequest } from '../../../azure/functions';

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
  return {
    config,
    featureFlags,
    logger,
    invocationId: invocationContext.invocationId,
    request: request ? await httpRequestToCamsHttpRequest(request) : undefined,
  } satisfies ApplicationContext;
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
