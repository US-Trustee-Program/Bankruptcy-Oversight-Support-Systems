import {
  HttpRequest,
  HttpResponse,
  InvocationContext,
  StorageQueueOutput,
  Timer,
} from '@azure/functions';
import { toAzureError, toAzureSuccess } from '../azure/functions';
import ContextCreator from '../azure/application-context-creator';
import { ForbiddenError } from '../../lib/common-errors/forbidden-error';

export type StartMessage = {
  flush?: boolean; // When true, flush queues to blob storage (bookend reporting pattern)
};

export type RangeMessage = {
  start: number;
  end: number;
};

export type CursorMessage = {
  lastId: string | null;
};

/**
 * isAuthorized
 *
 * Checks for a correct API key to be passed in the Authorization header of requests to
 * http triggers.
 *
 * @param request
 * @returns
 */
export function isAuthorized(request: HttpRequest) {
  const header = request.headers.get('Authorization');
  const parts = header ? header.split(' ') : ['', ''];
  return process.env.ADMIN_KEY && parts[0] === 'ApiKey' && parts[1] === process.env.ADMIN_KEY;
}

/**
 * buildFunctionName
 *
 * Builds an Azure function name as seen in the Azure Portal that avoids duplicate names
 * by using the MODULE_NAME as a name space.
 *
 * @param parts
 * @returns
 */
export function buildFunctionName(...parts): string {
  return parts.join('-').replace(/_/g, '-').replace(' ', '-');
}

/**
 * buildQueueName
 *
 * Builds an Azure storage queue name as seen in the Azure Portal that avoids duplicate names
 * by using the MODULE_NAME as a name space and abides by naming requirements.
 *
 * @param parts
 * @returns
 */
export function buildQueueName(...parts): string {
  return buildFunctionName(...parts).toLowerCase();
}

/**
 * buildContainerName
 *
 * Builds an Azure blob storage container name that avoids duplicate names
 * by using the MODULE_NAME as a namespace and follows Azure naming requirements.
 *
 * @param moduleName - The module name (e.g., ModuleNames.SYNC_OFFICE_STAFF)
 * @param direction - 'in' for input containers, 'out' for output containers
 * @returns Container name in format: [module-name]-[in|out]
 *
 * @example
 * buildContainerName('SYNC-OFFICE-STAFF', 'in')   // → 'sync-office-staff-in'
 * buildContainerName('MIGRATE_CASE_HISTORY', 'out') // → 'migrate-case-history-out'
 */
export function buildContainerName(moduleName: string, direction: 'in' | 'out'): string {
  return `${moduleName.toLowerCase().replace(/_/g, '-')}-${direction}`;
}

/**
 * buildHttpTrigger
 *
 * Wraps the provided function within a closure containing boiler-plate
 * authorization and HttpResponse logic.
 *
 * @param moduleName
 * @param fn
 * @returns
 */
export function buildHttpTrigger(
  moduleName: string,
  fn: (context: InvocationContext, request?: HttpRequest) => Promise<unknown>,
) {
  return async (request: HttpRequest, context: InvocationContext): Promise<HttpResponse> => {
    try {
      if (!isAuthorized(request)) {
        throw new ForbiddenError(moduleName);
      }

      await fn(context, request);

      return new HttpResponse(toAzureSuccess({ statusCode: 201 }));
    } catch (error) {
      return new HttpResponse(toAzureError(ContextCreator.getLogger(context), moduleName, error));
    }
  };
}

/**
 * buildStartQueueHttpTrigger
 *
 * Wraps common logic to add a start message to the provided storage queue in a closure used
 * as a http trigger.
 *
 * @param moduleName
 * @param queue
 * @returns
 */
export function buildStartQueueHttpTrigger(moduleName: string, queue: StorageQueueOutput) {
  return buildHttpTrigger(moduleName, async (context: InvocationContext) => {
    const startMessage: StartMessage = {};
    context.extraOutputs.set(queue, startMessage);
  });
}

/**
 * buildStartQueueTimerTrigger
 *
 * Wraps common logic to add a start message to the provided storage queue in a closure used
 * as a timer trigger.
 * @param _moduleName
 * @param queue
 * @returns
 */
export function buildStartQueueTimerTrigger(_moduleName: string, queue: StorageQueueOutput) {
  return async (_ignore: Timer, context: InvocationContext) => {
    const startMessage: StartMessage = {};
    context.extraOutputs.set(queue, startMessage);
  };
}

/**
 * ensureContainersExist
 *
 * Ensures blob storage containers exist, creating them if necessary.
 * This function is idempotent and safe to call on every function app startup.
 *
 * Container creation happens asynchronously in the background - this function
 * returns immediately and does not block function app initialization.
 *
 * @param containerNames - Array of container names to ensure exist
 * @param moduleName - Module name for logging context
 *
 * @example
 * // In setup() function
 * ensureContainersExist(
 *   [
 *     buildContainerName(MODULE_NAME, 'in'),
 *     buildContainerName(MODULE_NAME, 'out'),
 *   ],
 *   MODULE_NAME
 * );
 */
export function ensureContainersExist(containerNames: string[], moduleName: string): void {
  if (!containerNames || containerNames.length === 0) {
    return;
  }

  // Kick off async container creation without blocking
  // Use setImmediate to ensure it runs after current synchronous setup completes
  setImmediate(async () => {
    try {
      // Dynamic import to avoid circular dependencies and defer loading
      const { ensureContainersExistAsync } =
        await import('../../lib/adapters/gateways/storage/container-manager');
      await ensureContainersExistAsync(containerNames, moduleName);
    } catch (error) {
      // Log error but don't fail function app startup
      const logger = new (await import('../../lib/adapters/services/logger.service')).LoggerImpl(
        'bootstrap',
      );
      logger.error(
        moduleName,
        `Failed to ensure containers exist: ${containerNames.join(', ')}`,
        error,
      );
    }
  });
}
