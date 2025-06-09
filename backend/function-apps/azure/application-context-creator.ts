import * as jwt from 'jsonwebtoken';
import { HttpRequest, InvocationContext } from '@azure/functions';
import { ApplicationContext } from '../../lib/adapters/types/basic';
import { ApplicationConfiguration } from '../../lib/configs/application-configuration';
import { getFeatureFlags } from '../../lib/adapters/utils/feature-flag';
import { LoggerImpl } from '../../lib/adapters/services/logger.service';
import { azureToCamsHttpRequest } from './functions';
import { UnauthorizedError } from '../../lib/common-errors/unauthorized-error';
import { getUserSessionUseCase } from '../../lib/factory';
import { sanitizeDeep } from '../../lib/use-cases/validations';

const MODULE_NAME = 'APPLICATION-CONTEXT-CREATOR';

function getLogger(invocationContext: InvocationContext) {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const logWrapper: Console['log'] = (...args: any[]) => {
    invocationContext.log(args);
  };
  return new LoggerImpl(invocationContext.invocationId, logWrapper);
}

type ContextCreatorArgs = {
  invocationContext: InvocationContext;
  logger?: LoggerImpl;
  request?: HttpRequest;
};

async function applicationContextCreator<B = unknown>(
  args: ContextCreatorArgs,
): Promise<ApplicationContext<B>> {
  const { invocationContext, logger, request } = args;

  const context = await getApplicationContext<B>({
    invocationContext,
    logger,
    request,
  });
  context.request = sanitizeDeep(context.request, MODULE_NAME, context.logger);

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
    config,
    featureFlags,
    logger: logger ?? ContextCreator.getLogger(invocationContext),
    invocationId: invocationContext.invocationId,
    request: request ? await azureToCamsHttpRequest<B>(request) : undefined,
    session: undefined,
    closables: [],
    releasables: [],
    extraOutputs: invocationContext.extraOutputs,
  } satisfies ApplicationContext<B | unknown>;
}

async function getApplicationContextSession(context: ApplicationContext) {
  const authorizationHeader = context.request?.headers['authorization'];

  if (!authorizationHeader) {
    throw new UnauthorizedError(MODULE_NAME, {
      message: 'Authorization header missing.',
    });
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (!scheme || !token) {
    throw new UnauthorizedError(MODULE_NAME, {
      message: 'Authorization scheme and token not found in authorization header',
    });
  }

  const sessionUseCase = getUserSessionUseCase(context);

  switch (scheme) {
    case 'Bearer':
      if (!jwt.decode(token)) {
        throw new UnauthorizedError(MODULE_NAME, {
          message: 'Malformed Bearer token in authorization header',
        });
      }
      return sessionUseCase.lookup(context, token, context.config.authConfig.provider);
    case 'ApiKey':
      return sessionUseCase.lookupApiKey(context, token);
    default:
      throw new UnauthorizedError(MODULE_NAME, { message: 'Unsupported authorization scheme' });
  }
}

const ContextCreator = {
  applicationContextCreator,
  getApplicationContext,
  getApplicationContextSession,
  getLogger,
};

export default ContextCreator;
