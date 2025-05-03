import { HttpRequest, InvocationContext } from '@azure/functions';
import * as jwt from 'jsonwebtoken';

import { LoggerImpl } from '../../lib/adapters/services/logger.service';
import { ApplicationContext } from '../../lib/adapters/types/basic';
import { getFeatureFlags } from '../../lib/adapters/utils/feature-flag';
import { UnauthorizedError } from '../../lib/common-errors/unauthorized-error';
import { ApplicationConfiguration } from '../../lib/configs/application-configuration';
import { getUserSessionUseCase } from '../../lib/factory';
import { azureToCamsHttpRequest } from './functions';

const MODULE_NAME = 'APPLICATION-CONTEXT-CREATOR';

type ContextCreatorArgs = {
  invocationContext: InvocationContext;
  logger?: LoggerImpl;
  request?: HttpRequest;
};

async function applicationContextCreator<B = unknown>(
  args: ContextCreatorArgs,
): Promise<ApplicationContext<B>> {
  const { invocationContext, logger, request } = args;

  const context = await getApplicationContext<B>({ invocationContext, logger, request });

  context.session = await getApplicationContextSession(context);

  return context;
}

async function getApplicationContext<B = unknown>(
  args: ContextCreatorArgs,
): Promise<ApplicationContext<B>> {
  const { invocationContext, logger, request } = args;
  const config = new ApplicationConfiguration();
  const featureFlags = await getFeatureFlags(config);

  return {
    closables: [],
    config,
    extraOutputs: invocationContext.extraOutputs,
    featureFlags,
    invocationId: invocationContext.invocationId,
    logger: logger ?? ContextCreator.getLogger(invocationContext),
    releasables: [],
    request: request ? await azureToCamsHttpRequest<B>(request) : undefined,
    session: undefined,
  } satisfies ApplicationContext<B | unknown>;
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
  return sessionUseCase.lookup(context, accessToken, context.config.authConfig.provider);
}

function getLogger(invocationContext: InvocationContext) {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const logWrapper: Console['log'] = (...args: any[]) => {
    invocationContext.log(args);
  };
  return new LoggerImpl(invocationContext.invocationId, logWrapper);
}

const ContextCreator = {
  applicationContextCreator,
  getApplicationContext,
  getApplicationContextSession,
  getLogger,
};

export default ContextCreator;
