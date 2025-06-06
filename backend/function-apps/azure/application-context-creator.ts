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
import { CamsSession } from '../../../common/src/cams/session';
import * as crypto from 'node:crypto';

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

  switch (scheme) {
    case 'Bearer':
      return lookupBearerToken(context, token);
    case 'ApiKey':
      return lookupApiKeyToken(context, token);
    default:
      throw new UnauthorizedError(MODULE_NAME, { message: 'Unsupported authorization scheme' });
  }
}

async function lookupBearerToken(context: ApplicationContext, token: string): Promise<CamsSession> {
  if (!jwt.decode(token)) {
    throw new UnauthorizedError(MODULE_NAME, {
      message: 'Malformed Bearer token in authorization header',
    });
  }

  const sessionUseCase = getUserSessionUseCase(context);
  return sessionUseCase.lookup(context, token, context.config.authConfig.provider);
}

async function lookupApiKeyToken(
  _context: ApplicationContext,
  token: string,
): Promise<CamsSession> {
  if (token !== process.env.ADMIN_KEY) {
    throw new UnauthorizedError(MODULE_NAME, {
      message: 'Invalid API key in authorization header',
    });
  }
  // TODO: Convert the token to a hashed variant to use as the token to lookup in Cosmos.
  const hashedToken = crypto.createHash('sha256').update(token).digest('base64');
  // TODO: For now we will just return a static session since the current API key is also static.
  return {
    accessToken: hashedToken,
    expires: Date.now() + 3600 * 1000, // Now plus one hour.
    issuer: 'cams',
    provider: 'apikey',
    user: { id: 'apiuser', name: 'Api User' },
  };
}

const ContextCreator = {
  applicationContextCreator,
  getApplicationContext,
  getApplicationContextSession,
  getLogger,
};

export default ContextCreator;
