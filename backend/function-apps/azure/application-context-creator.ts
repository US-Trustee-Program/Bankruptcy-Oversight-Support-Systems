import * as jwt from 'jsonwebtoken';
import { InvocationContext, HttpRequest } from '@azure/functions';
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
  } satisfies ApplicationContext<B>;
}

async function getApplicationContextSession(context: ApplicationContext) {
  const authorizationHeader = context.request?.headers['authorization'];

  // Diagnostic logging for authorization troubleshooting
  context.logger.info(MODULE_NAME, 'API authorization check', {
    hasAuthHeader: !!authorizationHeader,
    authHeaderFormat: authorizationHeader
      ? `${authorizationHeader.split(' ')[0]} <${authorizationHeader.split(' ')[1]?.length || 0} chars>`
      : 'none',
  });

  if (!authorizationHeader) {
    context.logger.error(MODULE_NAME, 'Authorization header missing', {
      url: context.request?.url,
    });
    throw new UnauthorizedError(MODULE_NAME, {
      message: 'Authorization header missing.',
    });
  }

  const match = authorizationHeader.match(/Bearer (.+)/);

  if (!match || match.length !== 2) {
    context.logger.error(MODULE_NAME, 'Bearer token not found in authorization header', {
      authHeaderFormat: `${authorizationHeader.split(' ')[0]}`,
    });
    throw new UnauthorizedError(MODULE_NAME, {
      message: 'Bearer token not found in authorization header',
    });
  }

  let accessToken = '';
  const jwtToken = jwt.decode(match[1]);
  if (jwtToken) {
    accessToken = match[1];
    context.logger.info(MODULE_NAME, 'JWT decoded successfully', {
      tokenLength: accessToken.length,
    });
  } else {
    context.logger.error(MODULE_NAME, 'Malformed Bearer token in authorization header', {
      tokenLength: match[1]?.length || 0,
    });
    throw new UnauthorizedError(MODULE_NAME, {
      message: 'Malformed Bearer token in authorization header',
    });
  }

  const sessionUseCase = getUserSessionUseCase(context);
  return sessionUseCase.lookup(context, accessToken);
}

const ContextCreator = {
  applicationContextCreator,
  getApplicationContext,
  getApplicationContextSession,
  getLogger,
};

export default ContextCreator;
