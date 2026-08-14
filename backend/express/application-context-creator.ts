import { Request } from 'express';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { ApplicationConfiguration } from '../lib/configs/application-configuration';
import { getFeatureFlags } from '../lib/adapters/utils/feature-flag';
import { LoggerImpl } from '../lib/adapters/services/logger.service';
import { CamsDict, CamsHttpMethod, CamsHttpRequest } from '../lib/adapters/types/http';
import { getCamsError } from '../lib/common-errors/error-utilities';
import { AppInsightsObservability } from '../lib/adapters/services/observability';
import {
  finalizeApplicationContext,
  getApplicationContextSession as resolveApplicationContextSession,
} from '../lib/adapters/utils/application-context';

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
      params: request.params as CamsDict,
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
    observability: new AppInsightsObservability(logger),
    invocationId: requestId,
    request: expressToCamsHttpRequest<B>(request),
    session: undefined,
    closables: [],
    releasables: [],
    extraOutputs: undefined,
    notificationWarnings: [],
  } satisfies ApplicationContext<B>;
}

async function getApplicationContextSession(context: ApplicationContext) {
  return resolveApplicationContextSession(context, MODULE_NAME);
}

async function applicationContextCreator<B = unknown>(
  request: Request,
): Promise<ApplicationContext<B>> {
  const requestId = getRequestId();
  const logger = getLogger(requestId);

  // getApplicationContext evaluates feature flags with the anonymous context so
  // session resolution can read them (PIM role elevation is gated on the
  // 'privileged-identity-management' flag). finalizeApplicationContext then
  // resolves the session and re-evaluates flags for the authenticated user.
  const context = await getApplicationContext<B>(request, logger, requestId);
  return finalizeApplicationContext(context, MODULE_NAME);
}

const ContextCreator = {
  applicationContextCreator,
  expressToCamsHttpRequest,
  getApplicationContext,
  getApplicationContextSession,
  getLogger,
};

export default ContextCreator;
