import { InvocationContext, HttpRequest } from '@azure/functions';
import { ApplicationContext } from '../../lib/adapters/types/basic';
import { ApplicationConfiguration } from '../../lib/configs/application-configuration';
import { getFeatureFlags } from '../../lib/adapters/utils/feature-flag';
import { LoggerImpl } from '../../lib/adapters/services/logger.service';
import { azureToCamsHttpRequest } from './functions';
import factory from '../../lib/factory';
import { ObservabilityGateway } from '../../lib/use-cases/gateways.types';
import {
  finalizeApplicationContext,
  getApplicationContextSession as resolveApplicationContextSession,
} from '../../lib/adapters/utils/application-context';

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

  // getApplicationContext evaluates feature flags with the anonymous context so
  // session resolution can read them (PIM role elevation is gated on the
  // 'privileged-identity-management' flag). finalizeApplicationContext then
  // resolves the session and re-evaluates flags for the authenticated user.
  const context = await getApplicationContext<B>({
    invocationContext,
    logger,
    request,
  });
  return finalizeApplicationContext(context, MODULE_NAME);
}

async function getApplicationContext<B = unknown>(
  args: ContextCreatorArgs,
): Promise<ApplicationContext<B>> {
  const { invocationContext, logger, observability, request } = args;
  const config = new ApplicationConfiguration();
  const featureFlags = await getFeatureFlags(config);
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
    registeredExtraOutputQueueNames: getRegisteredExtraOutputQueueNames(invocationContext),
    notificationWarnings: [],
  } satisfies ApplicationContext<B>;
}

/**
 * Extracts the queue names this invocation's own extraOutputs registration declared, from
 * `InvocationContext.options.extraOutputs` (the effective options Azure Functions resolved for
 * this specific invocation). Only storage-queue outputs carry a `queueName`; other output types
 * (http, blob, table) are filtered out since they're not relevant to queue-write validation.
 * Returns undefined (not an empty array) when `options`/`options.extraOutputs` is missing --
 * e.g. bare-object test mocks that don't simulate the real InvocationContext shape -- so callers
 * treat "cannot determine what's registered" the same as running outside Azure Functions
 * entirely, rather than incorrectly concluding nothing is registered.
 */
function getRegisteredExtraOutputQueueNames(
  invocationContext: InvocationContext,
): string[] | undefined {
  const extraOutputs = invocationContext.options?.extraOutputs;
  if (!extraOutputs) {
    return undefined;
  }
  return extraOutputs
    .map((output) => (output as { queueName?: string }).queueName)
    .filter((queueName): queueName is string => !!queueName);
}

async function getApplicationContextSession(context: ApplicationContext) {
  return resolveApplicationContextSession(context, MODULE_NAME);
}

const ContextCreator = {
  applicationContextCreator,
  getApplicationContext,
  getApplicationContextSession,
  getLogger,
};

export default ContextCreator;
