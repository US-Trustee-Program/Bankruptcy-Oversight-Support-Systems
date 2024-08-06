import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { mockAuthentication } from '../lib/testing/mock-gateways/mock-oauth2-gateway';

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  request: HttpRequest,
): Promise<void> {
  const applicationContext = await ContextCreator.applicationContextCreator(
    functionContext,
    request,
  );
  try {
    const token = await mockAuthentication(applicationContext);
    functionContext.res = httpSuccess({ token });
  } catch (camsError) {
    applicationContext.logger.camsError(camsError);
    functionContext.res = httpError(camsError);
  }
};

export default httpTrigger;
