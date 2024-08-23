import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import { isCamsError } from '../lib/common-errors/cams-error';
import { UnknownError } from '../lib/common-errors/unknown-error';
import { ServerConfigError } from '../lib/common-errors/server-config-error';
import { ApplicationContext } from '../lib/adapters/types/basic';

export type Condition = (request: HttpRequest) => boolean;
export type Action = (request: ApplicationContext) => Promise<object>;
export type IfThen = { if: Condition; then: Action };
export const AnyCondition = () => true;

export function buildFunctionHandler(moduleName: string, ifThen: IfThen[]) {
  async function handler(
    request: HttpRequest,
    invocationContext: InvocationContext,
  ): Promise<HttpResponseInit> {
    const applicationContext = await ContextCreator.applicationContextCreator(
      invocationContext,
      request,
    );
    try {
      applicationContext.session =
        await ContextCreator.getApplicationContextSession(applicationContext);

      const action = ifThen.find((conditionAction) => conditionAction.if(request));
      if (action) {
        const response = await action.then(applicationContext);
        return httpSuccess(response);
      } else {
        throw new ServerConfigError(moduleName, { message: 'No matching condition for request' });
      }
    } catch (originalError) {
      const error = isCamsError(originalError)
        ? originalError
        : new UnknownError(moduleName, { originalError });
      applicationContext.logger.camsError(error);
      return httpError(error);
    }
  }
  return handler;
}
