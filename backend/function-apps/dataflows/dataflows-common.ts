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

export type StartMessage = object;

export type RangeMessage = {
  start: number;
  end: number;
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
