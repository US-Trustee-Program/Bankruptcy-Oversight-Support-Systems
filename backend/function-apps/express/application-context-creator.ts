import * as jwt from 'jsonwebtoken';
import { Request } from 'express';
import { ApplicationContext } from '../../lib/adapters/types/basic';
import { ApplicationConfiguration } from '../../lib/configs/application-configuration';
import { getFeatureFlags } from '../../lib/adapters/utils/feature-flag';
import { LoggerImpl } from '../../lib/adapters/services/logger.service';
import { expressToCamsHttpRequest } from './functions';
import { UnauthorizedError } from '../../lib/common-errors/unauthorized-error';
import { getUserSessionUseCase } from '../../lib/factory';
import { sanitizeDeep } from '../../lib/use-cases/validations';
import { v4 as uuidv4 } from 'uuid';

const MODULE_NAME = 'APPLICATION-CONTEXT-CREATOR';

function getLogger(invocationId?: string) {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const logWrapper: Console['log'] = (...args: any[]) => {
    console.log(`[${invocationId || 'unknown'}]`, ...args);
  };
  return new LoggerImpl(invocationId || uuidv4(), logWrapper);
}

type ContextCreatorArgs = {
  logger?: LoggerImpl;
  request?: Request;
  invocationId?: string;
};

async function applicationContextCreator<B = unknown>(
  args: ContextCreatorArgs,
): Promise<ApplicationContext<B>> {
  const { logger, request, invocationId } = args;

  const context = await getApplicationContext<B>({
    logger,
    request,
    invocationId,
  });
  context.request = sanitizeDeep(context.request, MODULE_NAME, context.logger);

  context.session = await getApplicationContextSession(context);

  return context;
}

async function getApplicationContext<B = unknown>(
  args: ContextCreatorArgs,
): Promise<ApplicationContext<B>> {
  const { logger, request, invocationId } = args;
  const config = new ApplicationConfiguration();
  const featureFlags = await getFeatureFlags(config);
  const contextInvocationId = invocationId || uuidv4();

  return {
    config,
    featureFlags,
    logger: logger ?? ContextCreator.getLogger(contextInvocationId),
    invocationId: contextInvocationId,
    request: request ? expressToCamsHttpRequest<B>(request) : undefined,
    session: undefined,
    closables: [],
    releasables: [],
    extraOutputs: undefined, // Express doesn't have extraOutputs like Azure Functions
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

const ContextCreator = {
  applicationContextCreator,
  getApplicationContext,
  getApplicationContextSession,
  getLogger,
};

export default ContextCreator;
