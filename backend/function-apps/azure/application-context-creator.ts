import * as jwt from 'jsonwebtoken';
import { InvocationContext, HttpRequest } from '@azure/functions';
import { ApplicationContext } from '../../lib/adapters/types/basic';
import { ApplicationConfiguration } from '../../lib/configs/application-configuration';
import { getFeatureFlags } from '../../lib/adapters/utils/feature-flag';
import { LoggerImpl } from '../../lib/adapters/services/logger.service';
import { azureToCamsHttpRequest } from './functions';
import { UnauthorizedError } from '../../lib/common-errors/unauthorized-error';
import { getUserSessionUseCase } from '../../lib/factory';

const MODULE_NAME = 'APPLICATION-CONTEXT-CREATOR';

function getLogger(invocationContext: InvocationContext) {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const logWrapper: Console['log'] = (...args: any[]) => {
    invocationContext.log(args);
  };
  return new LoggerImpl(invocationContext.invocationId, logWrapper);
}

async function applicationContextCreator<B = unknown>(
  invocationContext: InvocationContext,
  logger: LoggerImpl,
  request?: HttpRequest,
): Promise<ApplicationContext<B>> {
  const context = await getApplicationContext<B>({ invocationContext, logger, request });

  context.session = await getApplicationContextSession(context);

  return context;
}

async function getApplicationContext<B = unknown>(args: {
  invocationContext: InvocationContext;
  logger: LoggerImpl;
  request?: HttpRequest;
}): Promise<ApplicationContext<B>> {
  const { invocationContext, logger, request } = args;
  const config = new ApplicationConfiguration();
  const featureFlags = await getFeatureFlags(config);

  return {
    config,
    featureFlags,
    logger,
    invocationId: invocationContext.invocationId,
    request: request ? await azureToCamsHttpRequest<B>(request) : undefined,
    session: undefined,
    closables: [],
    releasables: [],
  } satisfies ApplicationContext<B>;
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

  const sessionUseCase = getUserSessionUseCase(context);
  const session = await sessionUseCase.lookup(
    context,
    accessToken,
    context.config.authConfig.provider,
  );
  return session;
}

const ContextCreator = {
  applicationContextCreator,
  getApplicationContext,
  getApplicationContextSession,
  getLogger,
};

export default ContextCreator;
