import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { httpSuccess } from '../lib/adapters/utils/http-response';
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
  const token = await mockAuthentication(applicationContext);
  functionContext.res = httpSuccess({ token });
};

export default httpTrigger;
