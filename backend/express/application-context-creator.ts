import * as jwt from 'jsonwebtoken';
import { Request } from 'express';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { ApplicationConfiguration } from '../lib/configs/application-configuration';
import { getFeatureFlags } from '../lib/adapters/utils/feature-flag';
import { LoggerImpl } from '../lib/adapters/services/logger.service';
import { CamsDict, CamsHttpMethod, CamsHttpRequest } from '../lib/adapters/types/http';
import { UnauthorizedError } from '../lib/common-errors/unauthorized-error';
import factory from '../lib/factory';
import { sanitizeDeep } from '../lib/use-cases/validations';
import { getCamsError } from '../lib/common-errors/error-utilities';
import { AppInsightsObservability } from '../lib/adapters/services/observability';

const MODULE_NAME = 'EXPRESS-CONTEXT-CREATOR';

let requestCounter = 0;

function getRequestId(): string {
  return `express-${Date.now()}-${++requestCounter}`;
}

function getLogger(requestId: string): LoggerImpl {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const logWrapper: Console['log'] = (...args: any[]) => {
    console.log(`[${requestId}]`, ...args);
  };
  return new LoggerImpl(requestId, logWrapper);
}

function expressToCamsHttpRequest<B = unknown>(request: Request): CamsHttpRequest<B> {
  try {
    const headers: CamsDict = {};
    Object.keys(request.headers).forEach((key) => {
      const value = request.headers[key];
      if (typeof value === 'string') {
        headers[key] = value;
      } else if (Array.isArray(value)) {
        headers[key] = value.join(', ');
      }
    });

    const protocol = request.secure ? 'https' : 'http';
    const host = request.get('host') || 'localhost:7071';
    const fullUrl = `${protocol}://${host}${request.url}`;

    return {
      method: request.method as CamsHttpMethod,
      url: fullUrl,
      headers,
      query: request.query as CamsDict,
      params: request.params,
      body: request.body as B | undefined,
    };
  } catch (originalError) {
    throw getCamsError(originalError, MODULE_NAME);
  }
}

async function getApplicationContext<B = unknown>(
  request: Request,
  logger: LoggerImpl,
  requestId: string,
): Promise<ApplicationContext<B>> {
  const config = new ApplicationConfiguration();
  const featureFlags = await getFeatureFlags(config);

  return {
    config,
    featureFlags,
    logger,
    observability: new AppInsightsObservability(),
    invocationId: requestId,
    request: expressToCamsHttpRequest<B>(request),
    session: undefined,
    closables: [],
    releasables: [],
    extraOutputs: undefined,
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

async function applicationContextCreator<B = unknown>(
  request: Request,
): Promise<ApplicationContext<B>> {
  const requestId = getRequestId();
  const logger = getLogger(requestId);

  const context = await getApplicationContext<B>(request, logger, requestId);
  context.request = sanitizeDeep(context.request, MODULE_NAME, context.logger);

  context.session = await getApplicationContextSession(context);

  return context;
}

const ContextCreator = {
  applicationContextCreator,
  expressToCamsHttpRequest,
  getApplicationContext,
  getLogger,
};

export default ContextCreator;
