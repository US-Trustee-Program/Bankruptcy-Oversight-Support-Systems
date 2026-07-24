import * as jwt from 'jsonwebtoken';
import { InvocationContext, HttpRequest } from '@azure/functions';
import { ApplicationContext } from '../../lib/adapters/types/basic';
import { ApplicationConfiguration } from '../../lib/configs/application-configuration';
import { getFeatureFlags } from '../../lib/adapters/utils/feature-flag';
import { LoggerImpl } from '../../lib/adapters/services/logger.service';
import { azureToCamsHttpRequest } from './functions';
import { UnauthorizedError } from '../../lib/common-errors/unauthorized-error';
import factory from '../../lib/factory';
import { sanitizeDeep } from '../../lib/use-cases/validations';
import { ObservabilityGateway } from '../../lib/use-cases/gateways.types';

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
  observability?: ObservabilityGateway;
  request?: HttpRequest;
};

async function applicationContextCreator<B = unknown>(
  args: ContextCreatorArgs,
): Promise<ApplicationContext<B>> {
  const { invocationContext, logger, request } = args;

  const context = await getApplicationContext<B>(
    {
      invocationContext,
      logger,
      request,
    },
    { skipFeatureFlags: true },
  );
  context.request = sanitizeDeep(context.request, MODULE_NAME, context.logger);

  context.session = await getApplicationContextSession(context);
  context.featureFlags = await getFeatureFlags(context.config, context.session.user);

  return context;
}

async function getApplicationContext<B = unknown>(
  args: ContextCreatorArgs,
  opts?: { skipFeatureFlags?: boolean },
): Promise<ApplicationContext<B>> {
  const { invocationContext, logger, observability, request } = args;
  const config = new ApplicationConfiguration();
  const featureFlags = opts?.skipFeatureFlags ? {} : await getFeatureFlags(config);
  const contextLogger = logger ?? ContextCreator.getLogger(invocationContext);

  return {
    config,
    featureFlags,
    logger: contextLogger,
    observability: observability ?? factory.getObservability(contextLogger),
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

  const sessionUseCase = factory.getUserSessionUseCase(context);
  return sessionUseCase.lookup(context, accessToken);
}

const ContextCreator = {
  applicationContextCreator,
  getApplicationContext,
  getApplicationContextSession,
  getLogger,
};

export default ContextCreator;
