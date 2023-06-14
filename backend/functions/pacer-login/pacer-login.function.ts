import { AzureFunction, Context } from '@azure/functions';
import { httpError, httpSuccess } from '../lib/adapters/utils/http';
import log from '../lib/adapters/services/logger.service';

const NAMESPACE = 'PACER-LOGIN-FUNCTION';
const httpTrigger: AzureFunction = async function (functionContext: Context): Promise<void> {
  try {
    const token = await pacerLoginController.getToken();
    functionContext.res = httpSuccess(functionContext, token);
  } catch (exception) {
    log.error(functionContext, NAMESPACE, 'caught error. ', exception);
    functionContext.res = httpError(functionContext, exception, 400);
  }
}
