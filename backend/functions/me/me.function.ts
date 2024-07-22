import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  request: HttpRequest,
): Promise<void> {
  const context = await ContextCreator.applicationContextCreator(functionContext, request);
  try {
    context.session = await ContextCreator.getApplicationContextSession(context);
    const response = { success: true, body: context.session };
    functionContext.res = httpSuccess(response);
  } catch (camsError) {
    context.logger.camsError(camsError);
    functionContext.res = httpError(camsError);
  }
};

export default httpTrigger;
