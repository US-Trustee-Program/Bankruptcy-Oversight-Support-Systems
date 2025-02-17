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

export const STORAGE_QUEUE_CONNECTION = 'AzureWebJobsStorage';

export type StartMessage = {
  invocationId: string;
};

export type RangeMessage = {
  start: number;
  end: number;
};

export function isAuthorized(request: HttpRequest) {
  const header = request.headers.get('Authorization');
  const parts = header ? header.split(' ') : ['', ''];
  return process.env.ADMIN_KEY && parts[0] === 'ApiKey' && parts[1] === process.env.ADMIN_KEY;
}

export function buildFunctionName(...parts): string {
  return parts.join('-').replace(/_/g, '-').replace(' ', '-');
}

export function buildQueueName(...parts): string {
  return buildFunctionName(...parts).toLowerCase();
}

export function buildHttpTrigger(moduleName: string, fn: (context: InvocationContext) => void) {
  async function httpTrigger(
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponse> {
    try {
      if (!isAuthorized(request)) {
        throw new ForbiddenError(moduleName);
      }

      fn(context);

      return new HttpResponse(toAzureSuccess({ statusCode: 201 }));
    } catch (error) {
      return new HttpResponse(toAzureError(ContextCreator.getLogger(context), moduleName, error));
    }
  }
  return httpTrigger;
}

export function buildStartQueueHttpTrigger(moduleName: string, queue: StorageQueueOutput) {
  return buildHttpTrigger(moduleName, (context: InvocationContext) => {
    const startMessage: StartMessage = {
      invocationId: context.invocationId,
    };
    context.extraOutputs.set(queue, startMessage);
  });
}

export function buildStartQueueTimerTrigger(_moduleName: string, queue: StorageQueueOutput) {
  async function timerTrigger(_ignore: Timer, context: InvocationContext) {
    const startMessage: StartMessage = {
      invocationId: context.invocationId,
    };
    context.extraOutputs.set(queue, startMessage);
  }
  return timerTrigger;
}
